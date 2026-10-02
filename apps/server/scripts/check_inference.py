import asyncio
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient
from fpdf import FPDF
from pypdf import PdfReader

from paperman.api import create_app
from paperman.config import Settings
from paperman.models import Catalog, CatalogEntry, WorkerState
from paperman.storage import FileStorage, file_hash, write_record
from paperman.worker import run_cycle


async def main() -> None:
    config = Settings()
    model = FileStorage(config.data_dir).settings()
    if model.provider == "demo" or not model.base_url or not model.model:
        raise ValueError("Configure a real model in Settings before running this check")
    model.review_before_filing = True

    with TemporaryDirectory(prefix="paperman-model-check-") as directory:
        root = Path(directory)
        runtime = Settings(
            data_dir=root, model_api_key=config.model_api_key, settle_seconds=0
        )
        storage = FileStorage(root)
        write_record(root / "settings.toml", model)
        catalog = Catalog(
            owners=[
                CatalogEntry(id="unknown", name="Unknown"),
                CatalogEntry(id="alice", name="Alice Smith", aliases=["A. Smith"]),
                CatalogEntry(id="bob", name="Bob Jones"),
            ]
        )
        write_record(root / "catalog.toml", catalog)
        pdf = FPDF()
        for text in [
            "GreenEnergy\nElectricity invoice E123\nTo: Alice Smith\n"
            "Issue date: 20 September 2026\nPage 1 of 2\n"
            "Electricity charges: 150 EUR. Payment due 10 October 2026.",
            "GreenEnergy\nElectricity invoice E123 continued\nTo: Alice Smith\n"
            "Page 2 of 2\nMeter readings and charges. Total: 150 EUR.",
            "",
            "City Clinic\nTo: Bob Jones\nIssue date: 23 September 2026\n"
            "Appointment confirmation\nPhysiotherapy appointment on 12 October 2026.",
            "Central Library\nTo: Casey Taylor\nMembership confirmation\n"
            "Your library membership is active. Bring your card to borrow books.",
        ]:
            pdf.add_page()
            pdf.set_font("Helvetica", size=14)
            pdf.multi_cell(w=180, h=10, text=text)
        source = root / "inbox" / "sample-mail.pdf"
        pdf.output(str(source))
        original_hash = file_hash(source)
        observed: dict[Path, tuple[int, int, float]] = {}
        state = WorkerState(status="idle")

        print(f"Testing {model.model} at {model.base_url}", flush=True)
        await run_cycle(storage, runtime, observed, state)
        await run_cycle(storage, runtime, observed, state)
        scans = storage.list_scans()
        assert len(scans) == 1, state.message
        scan = scans[0]
        assert scan.status == "review", scan.history[-1].message
        assert file_hash(source) == original_hash
        assert file_hash(storage.scan_path(scan.id, "original.pdf")) == original_hash
        assert storage.list_documents() == []
        proposal = scan.proposal
        assert proposal is not None
        print(proposal.model_dump_json(indent=2), flush=True)
        assert [item.pages for item in proposal.documents] == [[1, 2, 3], [4], [5]], (
            "The model did not separate the sample letters correctly"
        )
        assert [item.owner_id for item in proposal.documents] == [
            "alice",
            "bob",
            "unknown",
        ], "The model did not identify the sample recipients correctly"
        assert [item.document_date for item in proposal.documents] == [
            date(2026, 9, 20),
            date(2026, 9, 23),
            None,
        ], "The model confused the issue dates or invented a missing date"

        with TestClient(create_app(runtime)) as client:
            response = client.put(
                f"/api/scans/{scan.id}/review",
                content=proposal.model_dump_json(),
                headers={"Content-Type": "application/json"},
            )
            assert response.status_code == 200, response.text
        await run_cycle(storage, runtime, observed, state)
        scan = storage.get_scan(scan.id)
        assert scan.status == "complete", scan.history[-1].message
        assert not source.exists()
        assert file_hash(storage.scan_path(scan.id, "original.pdf")) == original_hash
        documents = sorted(storage.list_documents(), key=lambda item: item.source_pages)
        assert len(documents) == 3
        for document in documents:
            print(document.model_dump_json(indent=2), flush=True)
            assert document.enrichment_status == "complete", document.enrichment_error
            assert document.title.strip() and document.summary.strip()
            final_pdf = root / document.final_path
            assert len(PdfReader(final_pdf).pages) == len(document.source_pages)
            assert final_pdf.with_suffix(".toml").exists()
        assert {"invoice", "utilities"} <= set(documents[0].generated_tags)
        assert "health" in documents[1].generated_tags
        assert documents[2].date_source == "scan_fallback"
        assert documents[2].document_date == scan.scanned_at.date()

        document = documents[0]
        document.user_tags = ["tax"]
        document.excluded_tags = ["invoice"]
        document.enrichment_status = "pending"
        storage.save_document(document)
        await run_cycle(storage, runtime, observed, state)
        updated = storage.get_document(document.id)
        assert updated.enrichment_status == "complete", updated.enrichment_error
        assert updated.final_path == document.final_path
        assert updated.user_tags == ["tax"] and updated.excluded_tags == ["invoice"]
        assert len(storage.rebuild_index().entries) == 3
        print(
            "PASS: intake, OCR, split, owners, dates, review, filing, tags, rerun, and index",
            flush=True,
        )


if __name__ == "__main__":
    asyncio.run(main())
