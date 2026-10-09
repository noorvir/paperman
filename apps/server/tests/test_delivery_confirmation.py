from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry
from test_auth import SECRET, identity
from test_document_edit import create_document

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentEdit, DocumentPage
from paperman.auth import AuthSettings
from paperman.config import Settings
from paperman.models import Document, Scan, personal_inbox_id
from paperman.storage import FileStorage, write_record


def test_confirmed_owners_control_delivery_without_sharing_the_scan(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    catalog = store.catalog()
    catalog.owners += [
        CatalogEntry(id="alice", name="Alice"),
        CatalogEntry(id="company", name="Company"),
    ]
    write_record(store.root / "catalog.toml", catalog)
    scan = Scan(
        id=doc.scan_id,
        content_hash="test",
        original_name="scan.pdf",
        scanned_at=doc.scanned_at,
        arrivals=[],
        page_count=3,
        status="complete",
        phase="done",
        document_ids=[doc.id],
    )
    store.save_scan(scan)
    pdf = (store.root / doc.final_path).read_bytes()
    store.scan_path(scan.id, "original.pdf").write_bytes(pdf)
    store.scan_path(scan.id, "searchable.pdf").write_bytes(pdf)
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=SECRET),
        )
    )
    admin = identity([], "admin", subject="admin")
    alice = identity(["alice"], subject="alice-user")
    bob = identity(["alice"], subject="bob-user")
    for account in [alice, bob]:
        client.get("/api/workspace", headers=account).raise_for_status()
    url = f"/api/documents/{doc.id}"
    confirm = url + "/confirm-delivery"
    assert client.post(confirm, headers=alice, json={"revision": 0}).status_code == 403
    assert client.post(confirm, headers=admin, json={"revision": 0}).status_code == 422
    edit = DocumentEdit(
        revision=0,
        title=doc.title,
        owner_ids=["alice", "company"],
        document_date=doc.document_date,
        summary="",
        tag_ids=[],
        text="Original OCR",
    )
    response = client.put(url, headers=admin, json=edit.model_dump(mode="json"))
    response.raise_for_status()
    changed = DocumentDetail.model_validate_json(response.content).document
    assert client.post(confirm, headers=admin, json={"revision": 0}).status_code == 409
    response = client.post(confirm, headers=admin, json={"revision": changed.revision})
    response.raise_for_status()
    confirmed = Document.model_validate_json(response.content)
    assert confirmed.delivery_status == "delivered"
    assert confirmed.delivery_confirmation is not None
    assert confirmed.delivery_confirmation.by == "Alice"
    assert confirmed.pdf_revision == doc.pdf_revision
    assert (store.root / confirmed.final_path).read_bytes() == pdf
    assert confirmed.verification is None
    assert confirmed.access_user_ids == []
    assert client.get(url, headers=alice).status_code == 404
    assert client.get(url, headers=bob).status_code == 404
    assert (
        FileStorage(tmp_path).get_document(doc.id).delivery_confirmation
        == confirmed.delivery_confirmation
    )

    # A later account link delivers confirmed documents, including owners with no account at confirmation time.
    link = f"/api/inboxes/{personal_inbox_id('alice-user')}/routing"
    client.put(link, headers=admin, json={"owner_ids": ["alice"]}).raise_for_status()
    detail = DocumentDetail.model_validate_json(client.get(url, headers=alice).content)
    assert not detail.source.accessible
    assert client.get(url + "/pdf", headers=alice).status_code == 200
    assert client.get(f"/api/scans/{scan.id}/pdf", headers=alice).status_code == 404
    listed = DocumentPage.model_validate_json(
        client.get("/api/documents?delivery=delivered", headers=alice).content
    )
    assert [item.id for item in listed.items] == [doc.id]
    assert client.get(url, headers=bob).status_code == 404
    client.put(link, headers=admin, json={"owner_ids": []}).raise_for_status()
    assert client.get(url, headers=alice).status_code == 404
    client.put(
        link, headers=admin, json={"owner_ids": ["alice", "company"]}
    ).raise_for_status()

    # Admin verification stays independent from delivery.
    response = client.post(
        url + "/verify",
        headers=admin,
        json={"revision": confirmed.revision, "reviewer": "ignored"},
    )
    response.raise_for_status()
    verified = Document.model_validate_json(response.content)
    assert verified.verification is not None
    assert verified.delivery_confirmation == confirmed.delivery_confirmation
    edit.revision = verified.revision
    edit.owner_ids = ["company"]
    response = client.put(url, headers=admin, json=edit.model_dump(mode="json"))
    response.raise_for_status()
    changed = DocumentDetail.model_validate_json(response.content).document
    assert changed.delivery_confirmation is None and changed.delivery_status == "review"
    assert changed.verification == verified.verification
    assert client.get(url, headers=alice).status_code == 404
    response = client.post(confirm, headers=admin, json={"revision": changed.revision})
    response.raise_for_status()
    assigned = Document.model_validate_json(response.content)
    assert client.get(url, headers=alice).status_code == 200

    edit.revision = assigned.revision
    edit.source_pages = [2]
    response = client.put(url, headers=admin, json=edit.model_dump(mode="json"))
    response.raise_for_status()
    changed = DocumentDetail.model_validate_json(response.content).document
    assert changed.delivery_confirmation is None
    assert client.get(url, headers=alice).status_code == 404
    open_client = TestClient(
        create_app(Settings(data_dir=tmp_path), AuthSettings(auth_enabled=False))
    )
    assert open_client.get(url).status_code == 200
    assert open_client.get(f"/api/scans/{scan.id}/pdf").status_code == 200
