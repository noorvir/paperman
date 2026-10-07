from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from paperman_parser.models import Analysis, DocumentProposal
from test_pipeline import InterruptedStorage, create_pdf

from paperman.api import create_app
from paperman.api_models import DocumentDetail
from paperman.config import Settings
from paperman.document_names import rename_documents
from paperman.filing import file_documents
from paperman.models import Document, Scan
from paperman.storage import FileStorage, file_hash


def test_filing_names_are_unique_and_stable_after_interruption(tmp_path: Path) -> None:
    store = InterruptedStorage(tmp_path)
    timestamp = datetime(2026, 9, 30, 10, 30, tzinfo=UTC)
    scan = Scan(
        id="first",
        content_hash="first",
        original_name="incoming.pdf",
        scanned_at=timestamp,
        arrivals=[],
        page_count=3,
        phase="file",
        proposal=Analysis(
            documents=[
                DocumentProposal(
                    pages=pages,
                    title="Monthly__bill — September!",
                    document_date=date(2026, 9, 29),
                    confidence=1,
                )
                for pages in ([1, 2], [3])
            ]
        ),
    )
    store.save_scan(scan)
    create_pdf(store.scan_path(scan.id, "searchable.pdf"))
    with pytest.raises(OSError, match="Simulated disk failure"):
        file_documents(store, scan)
    reserved = store.get_scan(scan.id).filing_paths
    assert len(reserved) == 2

    restarted = FileStorage(tmp_path)
    completed = file_documents(restarted, restarted.get_scan(scan.id))
    assert completed.filing_paths == reserved
    first_paths = {doc.final_path for doc in restarted.list_documents()}
    assert first_paths == set(reserved.values())
    millis = int(timestamp.timestamp() * 1000)
    assert {Path(path).name for path in first_paths} == {
        f"2026-09-29-monthly-bill-september-{millis}.pdf",
        f"2026-09-29-monthly-bill-september-{millis + 1}.pdf",
    }
    first_hashes = {path: file_hash(tmp_path / path) for path in first_paths}

    second = scan.model_copy(update={"id": "second", "filing_paths": {}})
    restarted.save_scan(second)
    create_pdf(restarted.scan_path(second.id, "searchable.pdf"))
    file_documents(restarted, second)
    file_documents(restarted, completed)
    documents = restarted.list_documents()
    assert len({doc.final_path for doc in documents}) == 4
    assert len(list((tmp_path / "documents").glob("*/*.pdf"))) == 4
    assert first_hashes == {path: file_hash(tmp_path / path) for path in first_paths}


class InterruptedRename(FileStorage):
    def save_document(self, document: Document) -> None:
        raise OSError("Interrupted metadata update")


def test_rename_resumes_and_preserves_files_metadata_and_links(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    timestamp = datetime(2026, 9, 30, 10, 30, tzinfo=UTC)
    millis = int(timestamp.timestamp() * 1000)
    documents: list[Document] = []
    for number in range(2):
        doc = Document(
            id=f"document-{number}",
            scan_id="batch",
            source_pages=[number + 1],
            owner_ids=["unknown"],
            title="Electricity bill – corrected",
            document_date=date(2026, 9, 29),
            date_source="document",
            scanned_at=timestamp,
            final_path=f"documents/unknown/old__scanned_{number}.pdf",
            user_tags=["utilities"],
            summary="Corrected summary",
            text_override="Corrected text",
            enrichment_status="complete",
        )
        store.save_document(doc)
        create_pdf(tmp_path / doc.final_path)
        (tmp_path / doc.final_path).with_suffix(".txt").write_text("Original OCR")
        documents.append(doc)
    scan = Scan(
        id="batch",
        content_hash="hash",
        original_name="original_scan.pdf",
        scanned_at=timestamp,
        arrivals=[],
        status="complete",
        phase="done",
        document_ids=[doc.id for doc in documents],
        filing_paths={doc.id: doc.final_path for doc in documents},
    )
    store.save_scan(scan)
    create_pdf(store.scan_path(scan.id, "original.pdf"))
    original_hash = file_hash(store.scan_path(scan.id, "original.pdf"))
    hashes = {doc.id: file_hash(tmp_path / doc.final_path) for doc in documents}
    # An occupied name must never be replaced, even without metadata.
    occupied = (
        tmp_path
        / f"documents/unknown/2026-09-29-electricity-bill-corrected-{millis}.pdf"
    )
    occupied.write_bytes(b"Existing unrelated file")

    with pytest.raises(OSError, match="Interrupted metadata update"):
        rename_documents(InterruptedRename(tmp_path))
    assert (tmp_path / "state/rename-documents.json").exists()
    assert rename_documents(FileStorage(tmp_path)) == 2
    assert rename_documents(FileStorage(tmp_path)) == 0
    assert not (tmp_path / "state/rename-documents.json").exists()
    assert occupied.read_bytes() == b"Existing unrelated file"
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    updated_scan = store.get_scan(scan.id)
    assert updated_scan.document_ids == scan.document_ids
    for number, original in enumerate(documents, 1):
        doc = store.get_document(original.id)
        assert Path(doc.final_path).name == (
            f"2026-09-29-electricity-bill-corrected-{millis + number}.pdf"
        )
        assert hashes[doc.id] == file_hash(tmp_path / doc.final_path)
        assert not (tmp_path / original.final_path).exists()
        assert not (tmp_path / original.final_path).with_suffix(".toml").exists()
        assert not (tmp_path / original.final_path).with_suffix(".txt").exists()
        assert (tmp_path / doc.final_path).with_suffix(
            ".txt"
        ).read_text() == "Original OCR"
        assert doc.user_tags == original.user_tags
        assert doc.summary == original.summary
        assert doc.text_override == original.text_override
        assert doc.source_pages == original.source_pages
        assert doc.revision == original.revision + 1
        assert updated_scan.filing_paths[doc.id] == doc.final_path
        response = client.get(f"/api/documents/{doc.id}/pdf")
        assert response.status_code == 200
        assert Path(doc.final_path).name in response.headers["content-disposition"]
        detail = DocumentDetail.model_validate_json(
            client.get(f"/api/documents/{doc.id}").content
        )
        assert detail.document.final_path == doc.final_path
        assert detail.text == "Corrected text"
