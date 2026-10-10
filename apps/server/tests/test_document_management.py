import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from test_auth import SECRET, identity
from test_pipeline import FixtureInference
from test_reprocess import file_scan

from paperman.api import create_app
from paperman.auth import AuthSettings
from paperman.config import Settings
from paperman.models import Document, Inbox, personal_inbox_id
from paperman.pipeline import enrich_document
from paperman.storage import FileStorage, file_hash


def test_create_and_delete_preserve_source_and_other_documents(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    scan, originals = file_scan(store)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    original_hash = file_hash(store.scan_path(scan.id, "original.pdf"))
    other_hashes = {doc.id: file_hash(tmp_path / doc.final_path) for doc in originals}
    payload = dict(
        title="Selected pages",
        owner_ids=["alice", "bob"],
        creator_ids=["alice"],
        source_pages=[3, 1],
        document_date=None,
        tag_ids=["invoice"],
        filing_revision=scan.filing_revision,
    )
    url = f"/api/scans/{scan.id}/documents"
    assert client.post(url, json={**payload, "source_pages": []}).status_code == 422
    assert client.post(url, json={**payload, "source_pages": [1, 1]}).status_code == 422
    assert client.post(url, json={**payload, "source_pages": [99]}).status_code == 422
    response = client.post(url, json=payload)
    assert response.status_code == 201, response.text
    doc = Document.model_validate(response.json())
    assert doc.source_pages == [3, 1]
    assert doc.creator_ids == ["alice"]
    assert doc.verification is None
    assert doc.delivery_status == "review"
    assert len(PdfReader(tmp_path / doc.final_path).pages) == 2
    assert doc.user_tags == ["invoice"]
    assert doc.enrichment_status == "pending"
    assert len(doc.file_paths) == 2
    for path in doc.file_paths:
        assert (tmp_path / path).exists()
    assert client.post(url, json=payload).status_code == 409
    assert len(store.list_documents()) == len(originals) + 1
    assert doc.id in store.get_scan(scan.id).document_ids
    assert doc.id in {entry.document_id for entry in store.rebuild_index().entries}
    source_pdf = PdfReader(store.scan_path(scan.id, "searchable.pdf"))
    created_pdf = PdfReader(tmp_path / doc.final_path)
    assert created_pdf.pages[0].extract_text() == source_pdf.pages[2].extract_text()
    assert created_pdf.pages[1].extract_text() == source_pdf.pages[0].extract_text()
    asyncio.run(enrich_document(store, FixtureInference(), doc))
    doc = store.get_document(doc.id)
    assert doc.enrichment_status == "complete"
    assert doc.processed_at is not None
    assert doc.creator_ids == ["alice"]
    assert doc.user_tags == ["invoice"]
    delete_url = f"/api/documents/{doc.id}"
    assert client.delete(delete_url, params={"revision": 99}).status_code == 409
    doc.enrichment_status = "running"
    store.save_document(doc)
    assert (
        client.delete(delete_url, params={"revision": doc.revision}).status_code == 409
    )
    doc.enrichment_status = "complete"
    store.save_document(doc)
    assert (
        client.delete(delete_url, params={"revision": doc.revision}).status_code == 200
    )
    assert client.get(delete_url).status_code == 404
    assert client.get(f"{delete_url}/pdf").status_code == 404
    assert doc.id not in store.get_scan(scan.id).document_ids
    assert doc.id not in {entry.document_id for entry in store.rebuild_index().entries}
    for path in doc.file_paths:
        assert not (tmp_path / path).exists()
    assert list(
        store.scan_path(scan.id, "revisions").rglob(f"{Path(doc.final_path).name}")
    )
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash
    assert {
        doc.id: file_hash(tmp_path / doc.final_path) for doc in store.list_documents()
    } == other_hashes


@pytest.mark.parametrize("private", [False, True])
def test_management_permissions(tmp_path: Path, private: bool) -> None:
    store = FileStorage(tmp_path)
    scan, documents = file_scan(store)
    if private:
        inbox = Inbox(
            id=personal_inbox_id("alice-user"),
            name="Alice",
            account_id="alice-user",
            routing_owner_ids=["alice"],
        )
        store.save_inbox(inbox)
        scan.inbox_id = inbox.id
        store.save_scan(scan)
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=SECRET),
        )
    )
    url = f"/api/scans/{scan.id}/documents"
    value = dict(
        title="Private creation",
        creator_ids=[],
        tag_ids=[],
        owner_ids=["unknown"],
        source_pages=[1],
        document_date=None,
        filing_revision=scan.filing_revision,
    )
    assert client.post(url, json=value).status_code == 401
    assert (
        client.post(
            url, json=value, headers=identity([], subject="other-user")
        ).status_code
        == 404
    )
    admin = identity([], organization_role="admin", subject="admin-user")
    member = identity([])
    allowed, denied = (member, admin) if private else (admin, member)
    assert client.post(url, json=value, headers=denied).status_code == 404
    response = client.post(url, json=value, headers=allowed)
    assert response.status_code == 201, response.text
    doc = Document.model_validate(response.json())
    if private:
        assert doc.access_user_ids == ["alice-user"]
        assert doc.delivery_status == "delivered"
    else:
        # A recipient may read a shared document but must not delete it for everyone.
        doc.access_user_ids = ["alice-user"]
        store.save_document(doc)
        assert (
            client.delete(
                f"/api/documents/{doc.id}",
                params={"revision": doc.revision},
                headers=member,
            ).status_code
            == 403
        )
    assert (
        client.delete(
            f"/api/documents/{doc.id}",
            params={"revision": doc.revision},
            headers=allowed,
        ).status_code
        == 200
    )
    assert len(store.list_documents()) == len(documents)
