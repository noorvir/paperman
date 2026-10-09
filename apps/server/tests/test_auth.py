import time
from pathlib import Path
from typing import Literal

import jwt
import pytest
from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry
from test_document_edit import create_document

from paperman.api import create_app
from paperman.api_models import Dashboard, DocumentPage
from paperman.auth import AuthSettings
from paperman.config import Settings
from paperman.storage import FileStorage, write_record

SECRET = "auth-test-secret-not-for-production-123456"


def identity(
    owners: list[str],
    role: Literal["user", "admin"] = "user",
    mode: Literal["personal", "admin"] = "personal",
    *,
    expired: bool = False,
    issuer: str = "paperman-web",
    audience: str = "paperman-api",
    secret: str = SECRET,
) -> dict[str, str]:
    issued = int(time.time()) - (60 if expired else 0)
    token = jwt.encode(
        {
            "sub": "alice-user",
            "name": "Alice",
            "role": role,
            "mode": mode,
            "owner_ids": owners,
            "iss": issuer,
            "aud": audience,
            "iat": issued,
            "exp": issued + 30,
        },
        secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def protected(tmp_path: Path) -> tuple[TestClient, FileStorage]:
    store = FileStorage(tmp_path)
    original = create_document(store)
    original.enrichment_status = "complete"
    store.save_document(original)
    catalog = store.catalog()
    catalog.owners += [
        CatalogEntry(id="alice", name="Alice"),
        CatalogEntry(id="bob", name="Bob"),
    ]
    write_record(store.root / "catalog.toml", catalog)
    for id, owners in [("shared", ["alice", "bob"]), ("private", ["bob"])]:
        document = original.model_copy(
            update={
                "id": id,
                "owner_ids": owners,
                "title": id,
                "final_path": f"documents/{owners[0]}/{id}.pdf",
            }
        )
        path = store.root / document.final_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((store.root / original.final_path).read_bytes())
        path.with_suffix(".txt").write_text("Original OCR")
        store.save_document(document)
    store.rebuild_index()
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=SECRET),
        )
    )
    return client, store


def test_direct_api_requires_verified_identity(
    protected: tuple[TestClient, FileStorage],
) -> None:
    client, _ = protected
    for headers in [
        {},
        {"X-User-Id": "alice", "X-Role": "admin", "X-Owner-Ids": "bob"},
        identity(["bob"], expired=True),
        identity(["bob"], issuer="attacker"),
        identity(["bob"], audience="other-api"),
        identity(["bob"], secret="wrong-secret-value-that-is-long-enough"),
    ]:
        for url in [
            "/api/documents",
            "/api/dashboard",
            "/api/catalog",
            "/api/workspace",
            "/api/documents/shared",
            "/api/documents/shared/pdf",
            "/api/scans",
            "/api/settings",
        ]:
            assert client.get(url, headers=headers).status_code == 401


def test_owner_access_applies_to_search_counts_details_and_pdf(
    protected: tuple[TestClient, FileStorage],
) -> None:
    client, _ = protected
    headers = identity(["alice"])
    for query in ["", "?q=Original", "?owner=bob", "?tag=invoice"]:
        response = client.get("/api/documents" + query, headers=headers)
        page = DocumentPage.model_validate_json(response.content)
        assert [doc.id for doc in page.items] == ["shared"]
        assert page.total == 1
    for id in ["document", "private"]:
        assert client.get(f"/api/documents/{id}", headers=headers).status_code == 404
        assert (
            client.get(f"/api/documents/{id}/pdf", headers=headers).status_code == 404
        )
        assert (
            client.put(
                f"/api/documents/{id}/tags", json={"tag_ids": []}, headers=headers
            ).status_code
            == 404
        )
        assert (
            client.post(
                f"/api/documents/{id}/verify",
                json={"revision": 0, "reviewer": "Fake"},
                headers=headers,
            ).status_code
            == 404
        )
    assert client.get("/api/documents/shared", headers=headers).status_code == 200
    assert client.get("/api/documents/shared/pdf", headers=headers).status_code == 200
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard", headers=headers).content
    )
    assert dashboard.documents == 1
    assert [doc.id for doc in dashboard.unverified_documents] == ["shared"]
    assert dashboard.pipeline_items.total == 1
    assert dashboard.inbox_path == ""
    assert dashboard.worker is None
    for headers in [
        identity([]),
        identity([], "admin", "personal"),
        identity([], "user", "admin"),
    ]:
        page = DocumentPage.model_validate_json(
            client.get("/api/documents", headers=headers).content
        )
        assert page.total == 0
    page = DocumentPage.model_validate_json(
        client.get("/api/documents", headers=identity([], "admin", "admin")).content
    )
    assert page.total == 3


def test_personal_edits_cannot_change_owners_pages_or_process(
    protected: tuple[TestClient, FileStorage],
) -> None:
    client, store = protected
    headers = identity(["alice"])
    edit = {
        "revision": 0,
        "title": "Corrected",
        "owner_ids": ["alice", "bob"],
        "document_date": None,
        "summary": "Summary",
        "text": "Text",
        "tag_ids": ["health"],
    }
    for change in [
        {"owner_ids": ["alice"]},
        {"source_pages": [1]},
        {"rotations": [{"page": 1, "clockwise": 90}]},
    ]:
        assert (
            client.put(
                "/api/documents/shared", json=edit | change, headers=headers
            ).status_code
            == 403
        )
    assert (
        client.put("/api/documents/shared", json=edit, headers=headers).status_code
        == 200
    )
    assert (
        client.put(
            "/api/documents/shared/tags", json={"tag_ids": ["invoice"]}, headers=headers
        ).status_code
        == 200
    )
    doc = store.get_document("shared")
    result = client.post(
        "/api/documents/shared/verify",
        json={"revision": doc.revision, "reviewer": "Forged name"},
        headers=headers,
    )
    assert result.status_code == 200
    verified = store.get_document("shared").verification
    assert verified is not None and verified.by == "Alice"
    admin_requests: list[tuple[str, str, dict[str, str | list[str]] | None]] = [
        ("GET", "/api/scans", None),
        ("GET", "/api/scans/scan/pdf", None),
        ("GET", "/api/settings", None),
        ("POST", "/api/scans/scan/reprocess", {}),
        ("POST", "/api/uploads", None),
        ("POST", "/api/documents/shared/enrich", None),
        ("POST", "/api/catalog/owners", {"name": "Someone", "aliases": []}),
        ("POST", "/api/search/rebuild", None),
    ]
    for method, url, data in admin_requests:
        assert (
            client.request(method, url, json=data, headers=headers).status_code == 403
        )
    assert (
        client.get("/api/settings", headers=identity([], "admin", "admin")).status_code
        == 200
    )


def test_disabled_mode_needs_no_auth_and_enabled_configuration_fails_closed(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    create_document(store)
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=False, api_auth_secret=""),
        )
    )
    assert client.get("/api/documents").status_code == 200
    assert client.get("/api/documents/document/pdf").status_code == 200
    assert client.get("/api/settings").status_code == 200
    assert not list(tmp_path.rglob("*.sqlite"))
    with pytest.raises(ValueError, match="PAPERMAN_API_AUTH_SECRET"):
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=""),
        )
