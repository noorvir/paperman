import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from test_pipeline import (
    FixtureInference,
    FixtureOCR,
    InterruptedStorage,
    create_pdf,
)

from paperman.api import create_app
from paperman.api_models import DocumentPage, EntryRemoval
from paperman.config import Settings
from paperman.models import CatalogEntry
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, file_hash, write_record


def test_remove_owner_reassigns_and_resumes_partial_filing(tmp_path: Path) -> None:
    store = InterruptedStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    review = store.get_scan(scan.id)
    review.status = "queued"
    store.save_scan(review)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), review))
    assert store.get_scan(scan.id).status == "failed"
    document = store.list_documents()[0]
    original_hash = file_hash(tmp_path / document.final_path)
    stale_scan = store.get_scan(scan.id)

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.delete("/api/catalog/owners/alice")
    assert response.status_code == 200
    assert EntryRemoval.model_validate_json(response.content) == EntryRemoval(
        status="in_use", documents=1, scans=1
    )
    assert store.get_document(document.id).owner_id == "alice"
    assert any(owner.id == "alice" for owner in store.catalog().owners)

    for replacement in ("alice", "missing"):
        response = client.delete(
            "/api/catalog/owners/alice", params={"reassign_to": replacement}
        )
        assert response.status_code == 422
        assert store.get_document(document.id).owner_id == "alice"

    response = client.delete(
        "/api/catalog/owners/alice", params={"reassign_to": "unknown"}
    )
    assert response.status_code == 200
    assert EntryRemoval.model_validate_json(response.content).status == "removed"
    restarted = FileStorage(tmp_path)
    assert all(owner.id != "alice" for owner in restarted.catalog().owners)
    updated = restarted.get_document(document.id)
    assert updated.owner_id == "unknown"
    assert updated.final_path == document.final_path
    assert file_hash(tmp_path / updated.final_path) == original_hash
    proposal = restarted.get_scan(scan.id).proposal
    assert proposal is not None
    assert all(item.owner_id == "unknown" for item in proposal.documents)
    assert restarted.get_scan(scan.id).history[-1].stage == "ownership"

    # The worker may have read the queued scan before reassignment acquired the lock.
    asyncio.run(process_scan(restarted, FixtureInference(), FixtureOCR(), stale_scan))
    assert restarted.get_scan(scan.id).status == "complete"
    assert len(restarted.list_documents()) == 2
    assert restarted.get_document(document.id).final_path == document.final_path
    assert file_hash(tmp_path / document.final_path) == original_hash
    page = DocumentPage.model_validate_json(
        client.get("/api/documents", params={"owner": "unknown"}).content
    )
    assert page.total == 2
    assert client.get(f"/api/documents/{document.id}/pdf").status_code == 200


def test_remove_owner_checks_replacement_and_active_scans(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.extend(
        [CatalogEntry(id="alice", name="Alice"), CatalogEntry(id="bob", name="Bob")]
    )
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    assert client.delete("/api/catalog/owners/unknown").status_code == 422
    assert client.delete("/api/catalog/owners/missing").status_code == 404
    response = client.delete("/api/catalog/owners/alice")
    assert EntryRemoval.model_validate_json(response.content) == EntryRemoval(
        status="in_use", documents=0, scans=1
    )

    running = store.get_scan(scan.id)
    running.status = "running"
    store.save_scan(running)
    response = client.delete("/api/catalog/owners/alice", params={"reassign_to": "bob"})
    assert response.status_code == 409
    assert any(owner.id == "alice" for owner in store.catalog().owners)
    running.status = "review"
    store.save_scan(running)
    response = client.delete("/api/catalog/owners/alice", params={"reassign_to": "bob"})
    assert response.status_code == 200
    proposal = store.get_scan(scan.id).proposal
    assert proposal is not None
    assert proposal.documents[0].owner_id == "bob"

    created = client.post("/api/catalog/owners", json={"name": "Unused"})
    unused = CatalogEntry.model_validate_json(created.content)
    response = client.delete(f"/api/catalog/owners/{unused.id}")
    assert EntryRemoval.model_validate_json(response.content) == EntryRemoval(
        status="removed", documents=0, scans=0
    )
