import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import Catalog, CatalogEntry, Enrichment
from test_pipeline import FailingInference, FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import Dashboard, ScanDetail
from paperman.config import Settings
from paperman.models import Document, Scan, now
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, write_record


class FailingEnrichment(FixtureInference):
    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
        raise ConnectionError("Model offline")


def test_progress_tracks_failure_retry_review_and_enrichment(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    storage = FileStorage(tmp_path)
    catalog = storage.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox/mail.pdf"
    create_pdf(source)
    scan = storage.ingest(source)

    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=queued").content
    )
    assert dashboard.pipeline_items.status == "queued"
    assert [item.id for item in dashboard.pipeline_items.items] == [scan.id]

    scan.status = "running"
    storage.save_scan(scan)
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=running").content
    )
    assert dashboard.pipeline_items.status == "running"

    asyncio.run(process_scan(storage, FailingInference(), FixtureOCR(), scan))
    detail = ScanDetail.model_validate_json(client.get(f"/api/scans/{scan.id}").content)
    steps = {step.id: step for step in detail.pipeline}
    assert steps["ocr"].status == "complete"
    assert steps["analyze"].status == "failed"
    assert steps["ready"].status == "queued"
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=failed").content
    )
    assert dashboard.pipeline_items.status == "failed"
    assert dashboard.pipeline_items.items[0].status == "failed"

    client.post(f"/api/scans/{scan.id}/retry").raise_for_status()
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=queued").content
    )
    assert dashboard.pipeline_items.status == "queued"
    assert dashboard.pipeline_items.items[0].status == "queued"
    asyncio.run(process_scan(storage, FixtureInference(), FixtureOCR(), scan))
    reviewed = storage.get_scan(scan.id)
    assert reviewed.proposal is not None
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=review").content
    )
    assert dashboard.pipeline_items.total == 1
    client.put(
        f"/api/scans/{scan.id}/review", json=reviewed.proposal.model_dump(mode="json")
    ).raise_for_status()
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=queued").content
    )
    assert dashboard.pipeline_items.status == "queued"

    asyncio.run(process_scan(storage, FixtureInference(), FixtureOCR(), scan))
    documents = storage.list_documents()
    asyncio.run(enrich_document(storage, FixtureInference(), documents[0]))
    asyncio.run(enrich_document(storage, FailingEnrichment(), documents[1]))
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=failed").content
    )
    assert dashboard.counts == {
        "queued": 0,
        "running": 0,
        "review": 0,
        "failed": 1,
        "complete": 1,
    }
    assert dashboard.pipeline_items.items[0].kind == "document"
    assert dashboard.pipeline_items.items[0].id == documents[1].id
    detail = ScanDetail.model_validate_json(client.get(f"/api/scans/{scan.id}").content)
    steps = {step.id: step for step in detail.pipeline}
    assert steps["review"].detail == "Approved"
    assert steps["file"].status == "complete"
    assert steps["tag"].status == "failed"
    assert steps["ready"].status == "queued"

    asyncio.run(enrich_document(storage, FixtureInference(), documents[1]))
    detail = ScanDetail.model_validate_json(client.get(f"/api/scans/{scan.id}").content)
    assert all(step.status == "complete" for step in detail.pipeline)


def test_status_counts_cover_all_pages_and_exclude_unpublished_work(
    tmp_path: Path,
) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    storage = FileStorage(tmp_path)
    timestamp = now()
    scan = Scan(
        id="batch",
        content_hash="hash",
        original_name="batch.pdf",
        scanned_at=timestamp,
        arrivals=[],
        status="complete",
        phase="done",
    )
    for index in range(28):
        document = Document(
            id=f"document-{index}",
            scan_id=scan.id,
            source_pages=[index + 1],
            owner_id="unknown",
            title=f"Document {index}",
            document_date=timestamp.date(),
            date_source="scan_fallback",
            scanned_at=timestamp,
            final_path=f"documents/unknown/document-{index}.pdf",
            enrichment_status="complete",
        )
        storage.save_document(document)
        if index < 27:
            scan.document_ids.append(document.id)
    storage.save_scan(scan)
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=complete&page=2").content
    )
    assert dashboard.pipeline_items.total == 27
    assert dashboard.pipeline_items.pages == 2
    assert len(dashboard.pipeline_items.items) == 2
    assert dashboard.counts["complete"] == 27
    first_page = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=complete").content
    )
    first_ids = {item.id for item in first_page.pipeline_items.items}
    assert not first_ids.intersection(
        item.id for item in dashboard.pipeline_items.items
    )
    assert "document-27" not in first_ids
    for item in dashboard.pipeline_items.items:
        assert item.kind == "document"
        expected = storage.get_document(item.id)
        assert item.document == expected
        assert item.filename == Path(expected.final_path).name
        assert item.filename != scan.original_name

    scan.status = "running"
    scan.phase = "file"
    storage.save_scan(scan)
    dashboard = Dashboard.model_validate_json(
        client.get("/api/dashboard?status=complete&page=2").content
    )
    assert dashboard.pipeline_items.status == "complete"
    assert dashboard.pipeline_items.total == 0
    assert dashboard.pipeline_items.page == 1
    assert dashboard.counts["running"] == 1
    assert client.get("/api/dashboard?status=invalid").status_code == 422
    assert client.get("/api/dashboard?page=0").status_code == 422
