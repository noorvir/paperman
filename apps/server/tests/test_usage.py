import asyncio
from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import (
    Analysis,
    Catalog,
    CatalogEntry,
    ModelPricing,
    ProcessingUsage,
)
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import DocumentDetail
from paperman.config import Settings
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, write_record
from paperman.usage import record_scan_usage


def test_costs_survive_failure_filing_restart_and_repeated_tagging(
    tmp_path: Path,
) -> None:
    storage = FileStorage(tmp_path)
    catalog = storage.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = storage.ingest(source)

    class MeasuredInference(FixtureInference):
        fail = True

        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            record_scan_usage(
                storage,
                scan.id,
                ProcessingUsage(
                    stage="split",
                    source_pages=[1, 2, 3],
                    model="test",
                    base_url="test",
                    status="failed" if self.fail else "complete",
                    seconds=1,
                    estimated_cost_usd=Decimal("0.03"),
                    usage_complete=True,
                ),
            )
            if self.fail:
                raise ValueError("Model failed after usage was reported")
            result = await super().analyze(source, catalog)
            return result

    inference = MeasuredInference()
    asyncio.run(process_scan(storage, inference, FixtureOCR(), scan))
    failed = storage.get_scan(scan.id)
    assert failed.status == "failed"
    assert [call.stage for call in failed.processing] == ["ocr", "split"]
    inference.fail = False
    asyncio.run(process_scan(storage, inference, FixtureOCR(), failed))
    reviewed = storage.get_scan(scan.id)
    assert reviewed.status == "review"
    assert len(reviewed.processing) == 3
    # The approved proposal is already stored; file it without another model request.
    asyncio.run(process_scan(storage, inference, FixtureOCR(), reviewed))
    storage = FileStorage(tmp_path)
    documents = sorted(storage.list_documents(), key=lambda doc: doc.source_pages)
    assert [
        sum(item.estimated_cost_usd or Decimal(0) for item in doc.processing)
        for doc in documents
    ] == [Decimal("0.04"), Decimal("0.02")]
    tag_call = ProcessingUsage(
        stage="tagging",
        source_pages=[1],
        model="test",
        base_url="test",
        status="complete",
        seconds=1,
        estimated_cost_usd=Decimal("0.01"),
        usage_complete=True,
    )
    record_scan_usage(storage, scan.id, tag_call, page_map=[3])
    record_scan_usage(storage, scan.id, tag_call, page_map=[3])
    assert len(storage.get_scan(scan.id).processing) == 4
    second_call = tag_call.model_copy(update={"id": "new-tagging-call"})
    record_scan_usage(storage, scan.id, second_call, page_map=[3])
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    detail = DocumentDetail.model_validate_json(
        client.get(f"/api/documents/{documents[1].id}").text
    )
    assert sum(
        item.estimated_cost_usd or Decimal(0) for item in detail.document.processing
    ) == Decimal("0.04")
    assert [
        item.call.source_pages
        for item in detail.document.processing
        if item.call.stage == "tagging"
    ] == [[3], [3]]
    assert storage.get_document(documents[0].id).processing == documents[0].processing


def test_settings_edits_preserve_price_only_for_the_same_model(tmp_path: Path) -> None:
    storage = FileStorage(tmp_path)
    settings = storage.settings()
    settings.model = "test"
    settings.base_url = "http://model.test/v1"
    settings.pricing = ModelPricing(
        model=settings.model,
        base_url=settings.base_url,
        input_usd_per_million=Decimal(1),
        output_usd_per_million=Decimal(2),
        source="test",
        checked_on=date(2026, 10, 5),
    )
    write_record(tmp_path / "settings.toml", settings)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    value = settings.model_dump(mode="json", exclude={"pricing"})
    client.put("/api/settings", json=value).raise_for_status()
    assert storage.settings().pricing == settings.pricing
    value["model"] = "different"
    client.put("/api/settings", json=value).raise_for_status()
    assert storage.settings().pricing is None
