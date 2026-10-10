"""Exercise creator extraction, OCR, filing, enrichment, and API queries on isolated fixtures."""

import argparse
import asyncio
import os
import shutil
from pathlib import Path

from fastapi.testclient import TestClient
from fpdf import FPDF
from paperman_parser.inference import EndpointInference
from paperman_parser.models import (
    Catalog,
    CatalogEntry,
    InferenceSettings,
    ProcessingUsage,
    Record,
)
from paperman_parser.ocr import LocalOCR
from pydantic import Field

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentPage
from paperman.config import Settings
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, write_record


class Sample(Record):
    name: str
    text: str = ""
    source: str = ""
    expected_creators: list[str]
    expected_owners: list[str] = Field(default_factory=lambda: ["unknown"])
    title_contains: str


class Result(Record):
    sample: str
    title: str = ""
    creators: list[str] = Field(default_factory=list)
    passed: bool = False
    error: str = ""


class Report(Record):
    results: list[Result] = Field(default_factory=list)
    calls: list[ProcessingUsage] = Field(default_factory=list)


async def evaluate(
    settings_path: Path, catalog_path: Path, pdfs: Path, output: Path
) -> None:
    settings = InferenceSettings.model_validate_json(settings_path.read_bytes())
    catalog = Catalog.model_validate_json(catalog_path.read_bytes())
    catalog.creators.append(
        CatalogEntry(id="tk", name="TK", aliases=["Techniker Krankenkasse"])
    )
    samples = [
        Sample(
            name="invoice",
            source="01.pdf",
            expected_creators=["Cedar Bay"],
            expected_owners=["quarry-lane"],
            title_contains="invoice",
        ),
        Sample(
            name="purchase-order",
            source="02.pdf",
            expected_creators=["Juniper Works"],
            expected_owners=["willow-ridge"],
            title_contains="order",
        ),
        Sample(
            name="passport",
            text="PASSPORT - FICTIONAL TEST DOCUMENT\nRepublic of India\nHolder: Casey Rowan\nIssued by: Regional Passport Office, New Delhi\nDate of issue: 1 September 2026\nNo valid identity or travel rights.",
            expected_creators=[],
            expected_owners=["casey-rowan"],
            title_contains="passport",
        ),
        Sample(
            name="research-report",
            text="Measuring Heat Loss in Small Homes\nResearch report\nAuthors: Mira Patel and Leon Fischer\nAffiliation: Example University\nPublished by: Example Research Press\n1 September 2026\nAbstract: We compared wall insulation in twelve model homes. Better insulation reduced heat loss by 18 percent. Both authors designed the study and wrote this report.\nSynthetic test document.",
            expected_creators=["Mira Patel", "Leon Fischer"],
            title_contains="heat loss",
        ),
        Sample(
            name="pitch-deck",
            text="NORTHSTAR LABS\nInvestor pitch deck\nPrepared and presented by Northstar Labs GmbH\nSeptember 1, 2026\nOur product detects water leaks before they cause damage. We seek funding to make the first production units.\nSynthetic test document.",
            expected_creators=["Northstar Labs"],
            title_contains="pitch",
        ),
        Sample(
            name="memo",
            text="Internal memo\nFrom: Mira Patel\nTo: All project staff\nSubject: Lab access hours\nSeptember 1, 2026\nFrom Monday, the lab will open at 08:00. Mira Patel wrote and approved this memo.\nSynthetic test document.",
            expected_creators=["Mira Patel"],
            title_contains="lab",
        ),
        Sample(
            name="insurance-full-name",
            text="TECHNIKER KRANKENKASSE\nTo: Casey Rowan\n1 September 2026\nHealth insurance coverage confirmation\nYour health insurance coverage continues for the next year. Please keep this letter.\nSynthetic test document.",
            expected_creators=["TK"],
            expected_owners=["casey-rowan"],
            title_contains="coverage",
        ),
        Sample(
            name="insurance-acronym",
            text="TK\nTechniker Krankenkasse\nTo: Casey Rowan\n2 September 2026\nRequest for health insurance information\nPlease send your current employment details to update your policy.\nSynthetic test document.",
            expected_creators=["TK"],
            expected_owners=["casey-rowan"],
            title_contains="information",
        ),
        Sample(
            name="company-suffix",
            text="Northstar Labs GmbH\nInvoice 2026-109\nBill to: Quarry Lane\nIssued: 3 September 2026\nWater leak detector: EUR 100.00\nTotal payable: EUR 100.00\nSynthetic test document.",
            expected_creators=["Northstar Labs"],
            expected_owners=["quarry-lane"],
            title_contains="invoice",
        ),
    ]
    output.mkdir(parents=True, exist_ok=False)
    store = FileStorage(output / "data")
    write_record(store.root / "catalog.toml", catalog)
    report = Report()
    inference = EndpointInference(
        settings, os.environ["PAPERMAN_MODEL_API_KEY"], report.calls.append
    )
    client = TestClient(create_app(Settings(data_dir=store.root)))
    for sample in samples:
        result = Result(sample=sample.name)
        report.results.append(result)
        try:
            path = store.root / "inbox" / f"{sample.name}.pdf"
            if sample.source:
                shutil.copyfile(pdfs / sample.source, path)
            else:
                pdf = FPDF()
                pdf.add_page()
                pdf.set_font("Helvetica", size=14)
                pdf.multi_cell(w=180, h=9, text=sample.text)
                pdf.output(str(path))
            scan = store.ingest(path)
            await process_scan(store, inference, LocalOCR(), scan)
            scan = store.get_scan(scan.id)
            if scan.status != "complete":
                raise ValueError(
                    f"Scan status {scan.status}: {scan.history[-1].message}"
                )
            if len(scan.document_ids) != 1:
                raise ValueError("Expected exactly one filed document")
            document = store.get_document(scan.document_ids[0])
            await enrich_document(store, inference, document)
            response = client.get(f"/api/documents/{document.id}")
            response.raise_for_status()
            detail = DocumentDetail.model_validate_json(response.content)
            document = detail.document
            result.title = document.title
            directory = {entry.id: entry for entry in store.catalog().directory}
            result.creators = [directory[id].name for id in document.creator_ids]
            assert sorted(result.creators) == sorted(sample.expected_creators), (
                "Creator mismatch"
            )
            assert document.owner_ids == sample.expected_owners, "Owner mismatch"
            assert sample.title_contains.casefold() in document.title.casefold(), (
                "Title mismatch"
            )
            assert document.enrichment_status == "complete", "Enrichment failed"
            assert detail.text.strip(), "No extracted text"
            assert client.get(f"/api/documents/{document.id}/pdf").content.startswith(
                b"%PDF"
            )
            for id in document.creator_ids:
                found = DocumentPage.model_validate_json(
                    client.get("/api/documents", params={"creator": id}).content
                )
                assert document.id in [item.id for item in found.items], (
                    "Creator filter failed"
                )
            assert (
                FileStorage(store.root).get_document(document.id).creator_ids
                == document.creator_ids
            )
            result.passed = True
        except Exception as error:
            result.error = str(error)
        (output / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
        print(
            f"{sample.name}: {'PASS' if result.passed else 'FAIL'} | {result.title} | {result.creators} | {result.error}",
            flush=True,
        )
    if not all(result.passed for result in report.results):
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--settings", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--pdfs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)

    class Arguments(Record):
        settings: Path
        catalog: Path
        pdfs: Path
        output: Path

    args = Arguments.model_validate(vars(parser.parse_args()))
    asyncio.run(evaluate(args.settings, args.catalog, args.pdfs, args.output))
