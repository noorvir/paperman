import asyncio
import shutil
from pathlib import Path

import pytest
from fpdf import FPDF
from pypdf import PdfReader

from paperman.models import (
    Analysis,
    Catalog,
    CatalogEntry,
    Document,
    DocumentProposal,
    Enrichment,
    validate_analysis,
)
from paperman.pdf import LocalOCR, extract_pages
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, file_hash, write_record


class FixtureOCR:
    def searchable(self, source: Path, target: Path, languages: str) -> list[str]:
        shutil.copyfile(source, target)
        return extract_pages(target)


class FixtureInference:
    version = "test-v1"

    async def analyze(self, pages: list[str], catalog: Catalog) -> Analysis:
        return Analysis(
            documents=[
                DocumentProposal(
                    pages=[1, 2],
                    owner_id="alice",
                    title="Electricity bill",
                    confidence=0.98,
                ),
                DocumentProposal(
                    pages=[3],
                    owner_id="unknown",
                    title="Appointment letter",
                    confidence=0.7,
                ),
            ]
        )

    async def enrich(self, text: str, catalog: Catalog) -> Enrichment:
        return Enrichment(
            tag_ids=["invoice"],
            suggested_tags=["Home"],
            summary="An electricity invoice",
        )


class FailingInference(FixtureInference):
    async def analyze(self, pages: list[str], catalog: Catalog) -> Analysis:
        raise ConnectionError("GPU offline")


def create_pdf(path: Path) -> None:
    pdf = FPDF()
    for text in [
        "Alice Smith - Electricity invoice 21 June 2026",
        "Invoice continued - Total 150 EUR",
        "Appointment letter for unknown recipient",
    ]:
        pdf.add_page()
        pdf.set_font("Helvetica", size=14)
        pdf.multi_cell(w=180, h=10, text=text)
    pdf.output(str(path))


def test_scan_review_filing_and_repeatable_enrichment(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice Smith"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    original_hash = file_hash(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    assert scan.status == "review"
    assert scan.page_count == 3
    assert source.exists()
    assert store.list_documents() == []

    scan.status = "queued"
    store.save_scan(scan)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    assert scan.status == "complete"
    documents = sorted(store.list_documents(), key=lambda doc: doc.source_pages)
    assert [doc.source_pages for doc in documents] == [[1, 2], [3]]
    assert [doc.owner_id for doc in documents] == ["alice", "unknown"]
    assert all(doc.date_source == "scan_fallback" for doc in documents)
    assert [len(PdfReader(tmp_path / doc.final_path).pages) for doc in documents] == [
        2,
        1,
    ]
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash
    store.archive(scan)
    assert not source.exists()

    document = documents[0]
    document.user_tags = ["utilities"]
    document.excluded_tags = ["invoice"]
    store.save_document(document)
    for _ in range(2):
        asyncio.run(
            enrich_document(store, FixtureInference(), store.get_document(document.id))
        )
    updated = store.get_document(document.id)
    assert updated.final_path == document.final_path
    assert updated.generated_tags == ["invoice"]
    assert updated.user_tags == ["utilities"]
    assert updated.excluded_tags == ["invoice"]
    assert updated.enrichment_status == "complete"
    assert len(store.rebuild_index().entries) == 2

    duplicate = tmp_path / "inbox" / "second-copy.pdf"
    shutil.copyfile(store.scan_path(scan.id, "original.pdf"), duplicate)
    assert store.ingest(duplicate).id == scan.id
    assert not duplicate.exists()
    assert len(store.list_scans()) == 1
    assert len(store.list_documents()) == 2

    restored_root = tmp_path / "restored"
    shutil.copytree(tmp_path / "documents", restored_root / "documents")
    shutil.copytree(tmp_path / "scans", restored_root / "scans")
    shutil.copyfile(tmp_path / "catalog.toml", restored_root / "catalog.toml")
    for text_file in (restored_root / "documents").glob("*/*.txt"):
        text_file.unlink()
    restored = FileStorage(restored_root)
    assert len(restored.rebuild_index().entries) == 2
    assert restored.get_document(document.id).user_tags == ["utilities"]
    assert file_hash(restored.scan_path(scan.id, "original.pdf")) == original_hash


def test_gpu_failure_is_checkpointed_and_retryable(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FailingInference(), FixtureOCR(), scan))
    failed = store.get_scan(scan.id)
    assert failed.status == "failed"
    assert failed.phase == "analyze"
    assert store.scan_path(scan.id, "searchable.pdf").exists()
    assert source.exists()
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    failed.status = "queued"
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), failed))
    assert store.get_scan(scan.id).status == "review"
    assert store.get_scan(scan.id).attempts == 2


def test_review_requires_exact_page_coverage() -> None:
    for pages in ([1, 1, 3], [1, 3], [3, 2, 1], [1, 2, 3, 4]):
        proposal = Analysis(
            documents=[DocumentProposal(pages=pages, title="Test", confidence=1)]
        )
        with pytest.raises(ValueError, match="Every page"):
            validate_analysis(proposal, 3, Catalog())


def test_real_ocr_preserves_existing_text(tmp_path: Path) -> None:
    source = tmp_path / "original.pdf"
    create_pdf(source)
    digest = file_hash(source)
    pages = LocalOCR().searchable(source, tmp_path / "searchable.pdf", "eng")
    assert len(pages) == 3
    assert "Electricity" in pages[0]
    assert file_hash(source) == digest


def test_image_scan_gets_searchable_text(tmp_path: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGB", (1240, 1754), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=42)
    draw.text((100, 150), "ELECTRICITY INVOICE", fill="black", font=font)
    draw.text((100, 250), "Alice Smith", fill="black", font=font)
    draw.text((100, 350), "Total 150 EUR", fill="black", font=font)
    source = tmp_path / "scan.pdf"
    image.save(source, "PDF", resolution=150)
    assert not PdfReader(source).pages[0].extract_text().strip()
    pages = LocalOCR().searchable(source, tmp_path / "searchable.pdf", "eng")
    assert len(pages) == 1
    assert "INVOICE" in pages[0]
    assert "150" in pages[0]


class InvalidInference(FixtureInference):
    async def analyze(self, pages: list[str], catalog: Catalog) -> Analysis:
        return Analysis(
            documents=[
                DocumentProposal(
                    pages=[1, 1], owner_id="alice", title="Invoice", confidence=1
                )
            ]
        )


def test_invalid_model_proposal_is_reviewable_without_filing(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    settings = store.settings()
    settings.review_before_filing = False
    write_record(tmp_path / "settings.toml", settings)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, InvalidInference(), FixtureOCR(), scan))
    result = store.get_scan(scan.id)
    assert result.status == "review"
    assert result.proposal is not None
    assert result.history[-1].message.startswith("Every page")
    assert store.list_documents() == []


class InterruptedStorage(FileStorage):
    interrupt = True

    def save_document(self, document: Document) -> None:
        if self.interrupt and document.source_pages == [3]:
            self.interrupt = False
            raise OSError("Simulated disk failure")
        super().save_document(document)


def test_interrupted_filing_resumes_without_duplicate_documents(tmp_path: Path) -> None:
    store = InterruptedStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    scan.status = "queued"
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    assert store.get_scan(scan.id).status == "failed"
    assert len(store.list_documents()) == 1
    assert source.exists()
    failed = store.get_scan(scan.id)
    failed.status = "queued"
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), failed))
    assert store.get_scan(scan.id).status == "complete"
    assert len(store.list_documents()) == 2
    assert len(list((tmp_path / "documents").glob("*/*.pdf"))) == 2
