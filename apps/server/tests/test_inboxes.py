import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry
from test_auth import SECRET, identity
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import (
    Dashboard,
    DocumentAccess,
    DocumentDetail,
    DocumentPage,
    ScanPage,
    WorkspaceSettings,
)
from paperman.auth import AuthSettings
from paperman.config import Settings
from paperman.models import Inbox, Scan, WorkerState, personal_inbox_id
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, write_record


def test_personal_and_shared_delivery_keep_sources_and_metadata_separate(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=SECRET),
        )
    )
    alice = identity(["alice"])
    bob = identity(["alice"], subject="bob-user")
    admin = identity([], "admin", "admin", subject="admin-user")

    for headers in [alice, bob, admin]:
        assert client.get("/api/workspace", headers=headers).status_code == 200
    assert len(store.list_inboxes()) == 4

    result = client.put("/api/workspace", json={"time_format": "12h"}, headers=alice)
    assert result.status_code == 200
    assert WorkspaceSettings.model_validate_json(result.content).time_format == "12h"
    assert (
        WorkspaceSettings.model_validate_json(
            client.get("/api/workspace", headers=bob).content
        ).time_format
        == "24h"
    )
    assert len([inbox for inbox in store.list_inboxes() if inbox.id == "shared"]) == 1
    assert client.get("/api/workspace", headers=alice).status_code == 200
    assert len(store.list_inboxes()) == 4

    path = tmp_path / "source.pdf"
    create_pdf(path)
    content = path.read_bytes()
    scans: list[Scan] = []
    for headers in [alice, bob, admin]:
        query = "?inbox=shared" if headers == admin else ""
        result = client.post(
            "/api/uploads" + query,
            files={"file": ("mail.pdf", content, "application/pdf")},
            headers=headers,
        )
        assert result.status_code == 200, result.text
        scans.append(Scan.model_validate_json(result.content))
    assert len({scan.id for scan in scans}) == 3
    duplicate = client.post(
        "/api/uploads",
        files={"file": ("mail.pdf", content, "application/pdf")},
        headers=alice,
    )
    assert Scan.model_validate_json(duplicate.content).id == scans[0].id
    assert (
        client.post(
            "/api/uploads?inbox=shared",
            files={"file": ("mail.pdf", content)},
            headers=alice,
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/uploads?inbox={personal_inbox_id('bob-user')}",
            files={"file": ("mail.pdf", content)},
            headers=admin,
        ).status_code
        == 403
    )

    for scan in scans:
        asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
        current = store.get_scan(scan.id)
        assert current.status == "review"
        current.status = "queued"
        store.save_scan(current)
        asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), current))
    own, others, shared = [store.get_scan(scan.id) for scan in scans]
    own_doc = store.get_document(own.document_ids[0])
    assert own_doc.access_user_ids == ["alice-user"]
    assert own_doc.delivery_status == "delivered"
    assert own_doc.enrichment_status == "pending"
    assert client.get(f"/api/documents/{own_doc.id}", headers=alice).status_code == 200
    assert client.get(f"/api/documents/{own_doc.id}", headers=admin).status_code == 404
    assert client.get(f"/api/scans/{own.id}/pdf", headers=alice).content == content
    for headers in [bob, admin]:
        for suffix in ["", "/pdf", "/pdf?variant=searchable"]:
            assert (
                client.get(f"/api/scans/{own.id}{suffix}", headers=headers).status_code
                == 404
            )
        assert (
            client.get(f"/api/documents/{own_doc.id}/pdf", headers=headers).status_code
            == 404
        )
    for headers, visible in [
        (alice, {own.id}),
        (bob, {others.id}),
        (admin, {shared.id}),
    ]:
        listed = ScanPage.model_validate_json(
            client.get("/api/scans", headers=headers).content
        )
        assert {scan.id for scan in listed.items} == visible

    shared_doc = store.get_document(shared.document_ids[0])
    assert shared_doc.delivery_status == "review"
    assert (
        client.get(f"/api/documents/{shared_doc.id}", headers=alice).status_code == 404
    )
    assert client.get(f"/api/scans/{shared.id}/pdf", headers=admin).status_code == 200
    inbox = personal_inbox_id("alice-user")
    result = client.put(
        f"/api/inboxes/{inbox}/routing", json={"owner_ids": ["alice"]}, headers=admin
    )
    assert result.status_code == 200
    access_url = f"/api/documents/{shared_doc.id}/access"
    access = DocumentAccess.model_validate_json(
        client.get(access_url, headers=admin).content
    )
    assert access.suggested_user_ids == ["alice-user"]
    assert access.user_ids == []
    assert (
        client.get(f"/api/documents/{shared_doc.id}", headers=alice).status_code == 404
    )
    result = client.put(
        access_url,
        json={"revision": shared_doc.revision, "user_ids": ["alice-user"]},
        headers=admin,
    )
    assert result.status_code == 200, result.text
    detail = DocumentDetail.model_validate_json(
        client.get(f"/api/documents/{shared_doc.id}", headers=alice).content
    )
    assert detail.source.inbox == "shared" and not detail.source.accessible
    assert not detail.can_manage_access and not detail.can_edit_pages
    assert client.get(f"/api/scans/{shared.id}", headers=alice).status_code == 404
    assert client.get(f"/api/scans/{shared.id}/pdf", headers=alice).status_code == 404
    assert (
        client.get(
            f"/api/documents/{shared.document_ids[1]}", headers=alice
        ).status_code
        == 404
    )
    assert client.get(access_url, headers=alice).status_code == 403

    # A later correction to owner metadata cannot grant or remove delivery.
    shared_doc = store.get_document(shared_doc.id)
    result = client.put(
        f"/api/documents/{shared_doc.id}",
        headers=admin,
        json={
            "revision": shared_doc.revision,
            "owner_ids": ["unknown"],
            "title": shared_doc.title,
            "document_date": shared_doc.document_date.isoformat(),
            "summary": shared_doc.summary,
            "text": store.document_text(shared_doc),
            "tag_ids": [],
        },
    )
    assert result.status_code == 200, result.text
    reopened = FileStorage(tmp_path)
    assert reopened.get_document(shared_doc.id).access_user_ids == ["alice-user"]
    assert (
        client.get(f"/api/documents/{shared_doc.id}", headers=alice).status_code == 200
    )
    assert client.get(f"/api/documents/{shared_doc.id}", headers=bob).status_code == 404

    # Sharing a personal document with an admin does not share its source or siblings.
    result = client.put(
        f"/api/documents/{own_doc.id}/access",
        json={"revision": own_doc.revision, "user_ids": ["admin-user"]},
        headers=alice,
    )
    assert result.status_code == 200
    detail = DocumentDetail.model_validate_json(
        client.get(f"/api/documents/{own_doc.id}", headers=admin).content
    )
    assert not detail.source.accessible and not detail.can_manage_access
    assert set(detail.document.access_user_ids) == {"alice-user", "admin-user"}
    assert (
        client.get(f"/api/documents/{own.document_ids[1]}", headers=admin).status_code
        == 404
    )
    assert client.get(f"/api/scans/{own.id}/pdf", headers=admin).status_code == 404
    assert (
        client.put(
            f"/api/documents/{own_doc.id}/access",
            json={"revision": detail.document.revision, "user_ids": ["bob-user"]},
            headers=admin,
        ).status_code
        == 403
    )

    write_record(
        store.root / "state" / "worker.json",
        WorkerState(
            status="working", message="Processing private-confidential-letter.pdf"
        ),
    )
    response = client.get("/api/dashboard", headers=admin)
    assert "private-confidential-letter" not in response.text
    dashboard = Dashboard.model_validate_json(response.content)
    assert dashboard.documents == 3
    assert dashboard.routing_total == 1
    assert {doc.id for doc in dashboard.routing_documents} == {shared.document_ids[1]}
    for status in ["complete", "unverified", "running", "review"]:
        response = client.get(f"/api/dashboard?status={status}", headers=bob)
        dashboard = Dashboard.model_validate_json(response.content)
        assert dashboard.documents == 2
        assert dashboard.routing_total == 0
        assert own_doc.id not in response.text and shared_doc.id not in response.text

    latest = store.get_document(shared_doc.id)
    result = client.put(
        access_url, json={"revision": latest.revision, "user_ids": []}, headers=admin
    )
    assert result.status_code == 200
    assert (
        client.get(f"/api/documents/{shared_doc.id}/pdf", headers=alice).status_code
        == 404
    )
    assert store.get_document(shared_doc.id).delivery_status == "review"

    # The same persisted inboxes and files work with auth disabled.
    open_client = TestClient(
        create_app(Settings(data_dir=tmp_path), AuthSettings(auth_enabled=False))
    )
    all_docs = DocumentPage.model_validate_json(
        open_client.get("/api/documents").content
    )
    assert all_docs.total == 6
    assert open_client.get("/api/settings").status_code == 200
    assert open_client.get(f"/api/scans/{own.id}/pdf").status_code == 200


def test_account_registry_and_routing_require_admin(tmp_path: Path) -> None:
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=SECRET),
        )
    )
    account = {"account_id": "bob-user", "name": "Bob"}
    assert (
        client.put(
            "/api/inboxes/accounts", json=[account], headers=identity([])
        ).status_code
        == 403
    )
    admin = identity([], "admin", "admin")
    assert (
        client.put("/api/inboxes/accounts", json=[account], headers=admin).status_code
        == 200
    )
    assert (
        client.put("/api/inboxes/accounts", json=[account], headers=admin).status_code
        == 200
    )
    store = FileStorage(tmp_path)
    bob = store.get_inbox(personal_inbox_id("bob-user"))
    assert bob == Inbox(id=bob.id, name="Bob", account_id="bob-user")
    assert len(store.list_inboxes()) == 3
    assert (
        client.put(
            f"/api/inboxes/{bob.id}/routing",
            json={"owner_ids": ["unknown"]},
            headers=admin,
        ).status_code
        == 422
    )
