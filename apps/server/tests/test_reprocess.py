import asyncio
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import Analysis, Catalog, CatalogEntry, ProcessingUsage
from test_pipeline import FixtureInference, FixtureOCR, create_pdf
from test_regroup import InterruptedPublication

from paperman.api import create_app
from paperman.config import Settings
from paperman.models import Document, Scan, Verification, now
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, file_hash, write_record
from paperman.usage import record_scan_usage


def file_scan(store: FileStorage) -> tuple[Scan, list[Document]]:
    catalog = store.catalog()
    catalog.owners.extend(
        [CatalogEntry(id="alice", name="Alice"), CatalogEntry(id="bob", name="Bob")]
    )
    write_record(store.root / "catalog.toml", catalog)
    source = store.root / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    for _ in range(2):
        asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    assert scan.status == "complete"
    documents = sorted(store.list_documents(), key=lambda doc: doc.source_pages)
    return scan, documents


def test_reprocess_replaces_all_results_only_after_publication(tmp_path: Path) -> None:
    store = InterruptedPublication(tmp_path)
    scan, documents = file_scan(store)
    first = documents[0]
    first.verification = Verification(at=now(), by="Alice")
    first.owner_ids = ["alice", "bob"]
    first.title = "Manual title"
    first.user_tags = ["health"]
    first.summary = "Manual summary"
    first.summary_edited = True
    first.text_override = "Manual transcription"
    first.revision += 1
    store.save_document(first)
    record_scan_usage(
        store,
        scan.id,
        ProcessingUsage(
            stage="split",
            source_pages=[1, 2, 3],
            model="test",
            base_url="test",
            status="complete",
            seconds=1,
            estimated_cost_usd=Decimal("0.01"),
            usage_complete=True,
        ),
        processing_run=1,
    )
    documents = sorted(store.list_documents(), key=lambda doc: doc.source_pages)
    old_hashes = {
        relative: file_hash(tmp_path / relative)
        for doc in documents
        for relative in doc.file_paths
    }
    original_hash = file_hash(store.scan_path(scan.id, "original.pdf"))
    old_costs = {doc.id: doc.processing for doc in documents}
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    confirmation = {
        "filing_revision": scan.filing_revision,
        "document_revisions": {doc.id: doc.revision for doc in documents},
    }
    url = f"/api/scans/{scan.id}/reprocess"
    client.post(url, json=confirmation).raise_for_status()
    assert client.post(url, json=confirmation).status_code == 409
    queued = store.get_scan(scan.id)
    assert queued.processing_run == 2
    assert queued.filing_revision == 1
    assert queued.proposal is None
    assert queued.phase == "analyze"
    assert queued.ocr_rotations is None
    assert queued.document_ids == scan.document_ids
    assert {doc.id for doc in store.list_documents()} == set(scan.document_ids)

    class MeasuredInference(FixtureInference):
        fail = True
        sources: list[bytes] = []

        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            self.sources.append(source)
            record_scan_usage(
                store,
                scan.id,
                ProcessingUsage(
                    stage="split",
                    source_pages=[1, 2, 3],
                    model="test",
                    base_url="test",
                    status="failed" if self.fail else "complete",
                    seconds=1,
                    estimated_cost_usd=Decimal("0.02"),
                    usage_complete=True,
                ),
                processing_run=2,
            )
            if self.fail:
                raise ConnectionError("Model unavailable")
            proposal = await super().analyze(source, catalog)
            proposal.documents[0].owner_ids = ["alice", "bob"]
            return proposal

    inference = MeasuredInference()
    asyncio.run(process_scan(store, inference, FixtureOCR(), queued))
    failed = store.get_scan(scan.id)
    assert failed.status == "failed"
    assert {doc.id: doc.processing for doc in store.list_documents()} == old_costs
    assert {path: file_hash(tmp_path / path) for path in old_hashes} == old_hashes
    assert (
        client.put(f"/api/documents/{first.id}/tags", json={"tag_ids": []}).status_code
        == 409
    )

    client.post(f"/api/scans/{scan.id}/retry").raise_for_status()
    inference.fail = False
    asyncio.run(process_scan(store, inference, FixtureOCR(), failed))
    review = store.get_scan(scan.id)
    assert review.status == "review"
    assert review.proposal is not None
    assert review.ocr_rotations == []
    assert {doc.id for doc in store.list_documents()} == set(scan.document_ids)
    assert all(
        source == store.scan_path(scan.id, "original.pdf").read_bytes()
        for source in inference.sources
    )

    client.put(
        f"/api/scans/{scan.id}/review", json=review.proposal.model_dump(mode="json")
    ).raise_for_status()
    asyncio.run(process_scan(store, inference, FixtureOCR(), review))
    assert store.get_scan(scan.id).status == "failed"
    assert {doc.id for doc in store.list_documents()} == set(scan.document_ids)
    assert {path: file_hash(tmp_path / path) for path in old_hashes} == old_hashes

    restarted = FileStorage(tmp_path)
    client.post(f"/api/scans/{scan.id}/retry").raise_for_status()
    asyncio.run(process_scan(restarted, inference, FixtureOCR(), review))
    complete = restarted.get_scan(scan.id)
    assert complete.status == "complete"
    new_documents = sorted(restarted.list_documents(), key=lambda doc: doc.source_pages)
    assert new_documents[0].verification == first.verification
    assert [doc.source_pages for doc in new_documents] == [
        doc.source_pages for doc in documents
    ]
    assert set(complete.document_ids).isdisjoint(scan.document_ids)
    assert all(
        doc.processing_run == 2 and doc.enrichment_status == "pending"
        for doc in new_documents
    )
    assert all(
        not doc.user_tags and not doc.summary_edited and doc.text_override is None
        for doc in new_documents
    )
    assert sum(
        call.estimated_cost_usd or Decimal(0) for call in complete.processing
    ) == Decimal("0.05")
    assert sum(
        item.estimated_cost_usd or Decimal(0)
        for doc in new_documents
        for item in doc.processing
    ) == Decimal("0.04")
    assert (
        len(
            [
                call
                for call in complete.processing
                if call.stage == "ocr" and call.processing_run == 2
            ]
        )
        == 1
    )
    assert client.post(url, json=confirmation).status_code == 409

    restarted.archive(complete)
    restarted.archive(complete)
    assert not any((tmp_path / path).exists() for path in old_hashes)
    assert all(
        (tmp_path / path).exists() for doc in new_documents for path in doc.file_paths
    )
    archived = store.scan_path(scan.id, "revisions/0/documents")
    assert len(list(archived.rglob("*.pdf"))) == 2
    assert any(
        "Manual transcription" in path.read_text() for path in archived.rglob("*.toml")
    )
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash
    assert len(restarted.rebuild_index().entries) == 2


def test_reprocess_requires_current_confirmation_and_idle_tagging(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    scan, documents = file_scan(store)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    url = f"/api/scans/{scan.id}/reprocess"
    confirmation = {
        "filing_revision": scan.filing_revision,
        "document_revisions": {doc.id: doc.revision for doc in documents},
    }
    assert client.post(url).status_code == 422
    assert (
        client.post(url, json=confirmation | {"document_revisions": {}}).status_code
        == 409
    )
    assert (
        client.post(url, json=confirmation | {"filing_revision": 10}).status_code == 409
    )
    documents[0].enrichment_status = "running"
    store.save_document(documents[0])
    assert client.post(url, json=confirmation).status_code == 409
    documents[0].enrichment_status = "complete"
    store.save_document(documents[0])
    original = store.scan_path(scan.id, "original.pdf")
    original.rename(original.with_suffix(".saved"))
    assert client.post(url, json=confirmation).status_code == 409
    assert store.get_scan(scan.id).model_dump() == scan.model_dump()


def test_old_records_default_to_first_run(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    scan, documents = file_scan(store)
    legacy = scan.model_dump(
        mode="json",
        exclude={"processing_run": True, "processing": {"__all__": {"processing_run"}}},
    )
    loaded = Scan.model_validate(legacy)
    assert loaded.processing_run == 1
    assert all(call.processing_run == 1 for call in loaded.processing)
    assert (
        Document.model_validate(
            documents[0].model_dump(exclude={"processing_run"})
        ).processing_run
        == 1
    )
