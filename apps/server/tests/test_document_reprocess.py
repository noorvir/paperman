import asyncio
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from paperman_parser.inference import EndpointInference
from paperman_parser.models import Analysis, Catalog, Enrichment, ProcessingUsage
from test_pipeline import FixtureInference
from test_reprocess import file_scan

from paperman import worker
from paperman.api import create_app
from paperman.api_models import DocumentPage
from paperman.config import Settings
from paperman.models import Document, WorkerState
from paperman.pipeline import enrich_document
from paperman.storage import FileStorage, file_hash


@pytest.mark.parametrize("manual_summary", [False, True])
def test_document_reprocessing_uses_only_filed_pdf_and_preserves_filing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, manual_summary: bool
) -> None:
    store = FileStorage(tmp_path)
    scan, documents = file_scan(store)
    store.archive(scan)
    for document in documents:
        asyncio.run(enrich_document(store, FixtureInference(), document))
    target = store.get_document(documents[0].id)
    assert target.processed_at is not None
    target.owner_ids = ["alice", "bob"]
    target.user_tags = ["health"]
    target.excluded_tags = ["invoice"]
    target.summary = "Previous summary"
    target.summary_edited = manual_summary
    target.text_override = "Corrected text for search"
    store.save_document(target)
    other = store.get_document(documents[1].id)
    hashes = {path: file_hash(path) for path in tmp_path.rglob("*.pdf")}
    source = (tmp_path / target.final_path).read_bytes()
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    url = f"/api/documents/{target.id}/enrich"
    fail = True
    sources: list[bytes] = []

    class MeasuredInference(EndpointInference):
        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            raise AssertionError("A document rerun must not analyze the scan")

        async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
            sources.append(source)
            assert client.post(url).status_code == 409
            assert self.record_usage is not None
            self.record_usage(
                ProcessingUsage(
                    stage="tagging",
                    source_pages=[1, 2],
                    model="test",
                    base_url="test",
                    status="failed" if fail else "complete",
                    seconds=1,
                    usage_complete=True,
                    estimated_cost_usd=Decimal("0.001"),
                )
            )
            if fail:
                raise ConnectionError("Model unavailable")
            return Enrichment(
                tag_ids=["utilities", "invoice"],
                suggested_tags=["Energy"],
                summary="New electricity account summary",
            )

    monkeypatch.setattr(worker, "EndpointInference", MeasuredInference)
    client.post(url).raise_for_status()
    assert client.post(url).status_code == 409
    queued = store.get_document(target.id)
    assert queued.enrichment_status == "pending"
    assert queued.history[-1].message.startswith("Document reprocessing requested")
    assert queued.summary == target.summary
    assert queued.processed_at == target.processed_at

    # Use the actual worker path, including usage recording and search indexing.
    asyncio.run(
        worker.run_cycle(
            store, Settings(data_dir=tmp_path), {}, WorkerState(status="idle")
        )
    )
    failed = store.get_document(target.id)
    assert failed.enrichment_status == "failed"
    assert failed.generated_tags == target.generated_tags
    assert failed.summary == target.summary
    assert failed.enrichment_error
    assert failed.processed_at == target.processed_at
    assert store.get_document(other.id) == other

    fail = False
    client.post(url).raise_for_status()
    store = FileStorage(tmp_path)
    asyncio.run(
        worker.run_cycle(
            store, Settings(data_dir=tmp_path), {}, WorkerState(status="idle")
        )
    )
    updated = store.get_document(target.id)
    assert sources == [source, source]
    assert updated.enrichment_status == "complete"
    assert updated.processed_at is not None
    assert updated.processed_at > target.processed_at
    assert not updated.enrichment_error
    assert updated.generated_tags == ["invoice", "utilities"]
    assert updated.suggested_tags == ["Energy"]
    assert updated.summary == (
        target.summary if manual_summary else "New electricity account summary"
    )
    assert updated.user_tags == target.user_tags
    assert updated.excluded_tags == target.excluded_tags
    assert updated.text_override == target.text_override
    assert updated.owner_ids == target.owner_ids
    assert updated.document_date == target.document_date
    assert updated.date_source == target.date_source
    assert updated.title == target.title
    assert updated.source_pages == target.source_pages
    assert updated.final_path == target.final_path
    assert updated.processing_run == target.processing_run
    assert store.get_document(other.id) == other
    assert {path: file_hash(path) for path in tmp_path.rglob("*.pdf")} == hashes
    current_scan = store.get_scan(scan.id)
    assert current_scan.document_ids == scan.document_ids
    assert current_scan.attempts == scan.attempts
    assert current_scan.proposal == scan.proposal
    assert current_scan.processing_run == scan.processing_run
    assert [call.stage for call in current_scan.processing] == [
        "ocr",
        "tagging",
        "tagging",
    ]
    assert sum(
        item.estimated_cost_usd or Decimal(0) for item in updated.processing
    ) == Decimal("0.002")
    matches = DocumentPage.model_validate_json(
        client.get("/api/documents?q=corrected+text").content
    )
    assert [doc.id for doc in matches.items] == [target.id]
    assert matches.items[0].processed_at == updated.processed_at
    if not manual_summary:
        matches = DocumentPage.model_validate_json(
            client.get("/api/documents?q=electricity+account+summary").content
        )
        assert [doc.id for doc in matches.items] == [target.id]

    current_scan.status = "queued"
    store.save_scan(current_scan)
    assert client.post(url).status_code == 409
    assert store.get_document(target.id) == updated

    legacy = Document.model_validate(updated.model_dump(exclude={"processed_at"}))
    assert legacy.processed_at == updated.processed_at
    legacy = Document.model_validate(
        updated.model_dump(exclude={"processed_at", "history"})
    )
    call = updated.processing[-1].call
    assert call.status == "complete"
    assert legacy.processed_at == call.started_at + timedelta(seconds=call.seconds)
