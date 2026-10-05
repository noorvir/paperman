import asyncio
import shutil
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from fpdf import FPDF
from paperman_parser.models import (
    Analysis,
    Catalog,
    CatalogEntry,
    DocumentProposal,
    Enrichment,
    validate_analysis,
)
from paperman_parser.ocr import SearchableDocument
from pypdf import PdfReader, PdfWriter

from paperman.api import create_app
from paperman.api_models import ScanReview
from paperman.config import Settings
from paperman.models import Document
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, file_hash, write_record


class FixtureOCR:
    def searchable(self, source: bytes, languages: str) -> SearchableDocument:
        pages = [page.extract_text() for page in PdfReader(BytesIO(source)).pages]
        return SearchableDocument(pdf=source, pages=pages)


class FixtureInference:
    version = "test-v1"

    async def revise(
        self, source: bytes, catalog: Catalog, proposal: Analysis, instructions: str
    ) -> Analysis:
        raise NotImplementedError("This test adapter does not revise proposals")

    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
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

    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
        return Enrichment(
            tag_ids=["invoice"],
            suggested_tags=["Home"],
            summary="An electricity invoice",
        )


class FailingInference(FixtureInference):
    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
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
    for blanks in ([2, 2], [1, 2], [4], []):
        proposal = Analysis(
            documents=[DocumentProposal(pages=[1, 3], title="Test", confidence=1)],
            blank_pages=blanks,
        )
        with pytest.raises(ValueError, match="Every page"):
            validate_analysis(proposal, 3, Catalog())


class InvalidInference(FixtureInference):
    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
        return Analysis(
            documents=[
                DocumentProposal(
                    pages=[1, 1], owner_id="alice", title="Invoice", confidence=1
                )
            ]
        )


class ConfidentInference(FixtureInference):
    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
        return Analysis(
            documents=[
                DocumentProposal(
                    pages=[1, 2, 3], owner_id="alice", title="Invoice", confidence=1
                )
            ]
        )


@pytest.mark.parametrize(
    ("confidence", "reason", "review_all", "expected_status"),
    [
        (1, "", False, "complete"),
        (1, " ", False, "complete"),
        (0.9, "", False, "complete"),
        (0.89, "", False, "review"),
        (0.99, "Is page 3 a separate document?", False, "review"),
        (1, "", True, "review"),
    ],
)
def test_selective_review_distinguishes_absence_from_uncertainty(
    tmp_path: Path,
    confidence: float,
    reason: str,
    review_all: bool,
    expected_status: str,
) -> None:
    class ReviewInference(FixtureInference):
        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            return Analysis(
                documents=[
                    DocumentProposal(
                        pages=[1, 2, 3],
                        owner_id="unknown",
                        title="Guide",
                        document_date=None,
                        confidence=confidence,
                        review_reason=reason,
                    )
                ]
            )

    store = FileStorage(tmp_path)
    settings = store.settings()
    assert not settings.review_before_filing
    settings.review_before_filing = review_all
    write_record(tmp_path / "settings.toml", settings)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, ReviewInference(), FixtureOCR(), scan))
    result = store.get_scan(scan.id)
    assert result.status == expected_status
    if expected_status == "complete":
        document = store.list_documents()[0]
        assert document.owner_id == "unknown"
        assert document.date_source == "scan_fallback"
        assert document.document_date == scan.scanned_at.date()
    else:
        assert store.list_documents() == []


def test_empty_page_requires_review_even_with_confident_analysis(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    settings = store.settings()
    settings.review_before_filing = False
    write_record(tmp_path / "settings.toml", settings)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    reader = PdfReader(source)
    writer = PdfWriter()
    writer.add_page(reader.pages[0])
    writer.add_blank_page(width=595, height=842)
    writer.add_page(reader.pages[2])
    writer.write(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, ConfidentInference(), FixtureOCR(), scan))
    result = store.get_scan(scan.id)
    assert result.status == "review"
    assert result.proposal is not None
    assert "No readable text on pages 2" in result.proposal.documents[0].review_reason
    assert result.proposal.documents[0].pages == [1, 2, 3]
    assert not store.list_documents()


def test_blank_removal_filing_restart_and_manual_restoration(tmp_path: Path) -> None:
    class BlankInference(FixtureInference):
        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            return Analysis(
                documents=[
                    DocumentProposal(
                        pages=[2, 4], owner_id="alice", title="Invoice", confidence=1
                    )
                ],
                blank_pages=[1, 3, 5],
            )

    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    settings = store.settings()
    settings.review_before_filing = False
    write_record(tmp_path / "settings.toml", settings)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    reader = PdfReader(source)
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    writer.add_page(reader.pages[0])
    writer.add_blank_page(width=595, height=842)
    writer.add_page(reader.pages[1])
    writer.add_blank_page(width=595, height=842)
    writer.write(source)
    original_hash = file_hash(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, BlankInference(), FixtureOCR(), scan))

    restarted = FileStorage(tmp_path)
    complete = restarted.get_scan(scan.id)
    assert complete.status == "complete"
    assert complete.proposal is not None
    assert complete.proposal.blank_pages == [1, 3, 5]
    document = restarted.list_documents()[0]
    assert document.source_pages == [2, 4]
    filed = PdfReader(tmp_path / document.final_path)
    assert len(filed.pages) == 2
    assert "Total 150" in filed.pages[1].extract_text()
    assert len(PdfReader(restarted.scan_path(scan.id, "searchable.pdf")).pages) == 5
    assert file_hash(restarted.scan_path(scan.id, "original.pdf")) == original_hash
    assert "1, 3, 5" in complete.history[-1].message
    complete.status = "queued"
    complete.phase = "file"
    restarted.save_scan(complete)
    asyncio.run(process_scan(restarted, BlankInference(), FixtureOCR(), complete))
    assert len(restarted.list_documents()) == 1

    # Restore one omitted source page through the public review operation.
    proposal = complete.proposal.model_copy(deep=True)
    proposal.documents[0].pages = [2, 3, 4]
    proposal.blank_pages = [1, 5]
    review = ScanReview(
        documents=proposal.documents,
        blank_pages=proposal.blank_pages,
        document_revisions={document.id: document.revision},
    )
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    client.put(
        f"/api/scans/{scan.id}/review", json=review.model_dump(mode="json")
    ).raise_for_status()
    asyncio.run(process_scan(restarted, BlankInference(), FixtureOCR(), complete))
    updated = restarted.get_scan(scan.id)
    assert updated.proposal is not None
    assert updated.proposal.blank_pages == [1, 5]
    restored = restarted.list_documents()[0]
    assert restored.source_pages == [2, 3, 4]
    assert len(PdfReader(tmp_path / restored.final_path).pages) == 3
    assert file_hash(restarted.scan_path(scan.id, "original.pdf")) == original_hash


def test_all_blank_scan_requires_confirmation_and_preserves_original(
    tmp_path: Path,
) -> None:
    class BlankInference(FixtureInference):
        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            return Analysis(documents=[], blank_pages=[1, 2])

    store = FileStorage(tmp_path)
    settings = store.settings()
    settings.review_before_filing = False
    write_record(tmp_path / "settings.toml", settings)
    source = tmp_path / "inbox" / "empty.pdf"
    writer = PdfWriter()
    for _ in range(2):
        writer.add_blank_page(width=595, height=842)
    writer.write(source)
    original_hash = file_hash(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, BlankInference(), FixtureOCR(), scan))
    review = store.get_scan(scan.id)
    assert review.status == "review"
    assert review.proposal is not None
    assert "All pages were marked blank" in review.history[-1].message
    assert not store.list_documents()

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    client.put(
        f"/api/scans/{scan.id}/review", json=review.proposal.model_dump(mode="json")
    ).raise_for_status()
    asyncio.run(process_scan(store, BlankInference(), FixtureOCR(), review))
    complete = store.get_scan(scan.id)
    assert complete.status == "complete"
    assert not complete.document_ids
    assert not store.list_documents()
    store.archive(complete)
    assert not source.exists()
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash


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
