import asyncio
import tomllib
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import (
    Analysis,
    Catalog,
    CatalogEntry,
    DocumentProposal,
    PageRotation,
)
from paperman_parser.ocr import SearchableDocument
from pypdf import PdfReader
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentPage
from paperman.config import Settings
from paperman.document_names import rename_documents
from paperman.models import Document
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, file_hash, write_record


def test_shared_copies_edits_filters_owner_removal_and_restart(tmp_path: Path) -> None:
    class SharedInference(FixtureInference):
        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            return Analysis(
                documents=[
                    DocumentProposal(
                        pages=[1, 2, 3],
                        owner_ids=["alice", "bob"],
                        title="ARD fee registration confirmation",
                        confidence=1,
                    )
                ]
            )

    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.extend(
        [CatalogEntry(id="alice", name="Alice"), CatalogEntry(id="bob", name="Bob")]
    )
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox/mail.pdf"
    create_pdf(source)
    original_hash = file_hash(source)
    scan = store.ingest(source)
    inference = SharedInference()
    asyncio.run(process_scan(store, inference, FixtureOCR(), scan))
    assert store.get_scan(scan.id).status == "complete"
    document = store.list_documents()[0]
    assert document.owner_ids == ["alice", "bob"]
    assert len(store.list_documents()) == 1
    copies = [tmp_path / path for path in document.file_paths]
    assert len(copies) == 2
    assert file_hash(copies[0]) == file_hash(copies[1])

    asyncio.run(enrich_document(store, inference, document))
    store = FileStorage(tmp_path)
    updated = store.get_document(document.id)
    for path in copies:
        assert (
            Document.model_validate(
                tomllib.loads(path.with_suffix(".toml").read_text())
            )
            == updated
        )
        assert path.with_suffix(".txt").read_text() == store.document_text(updated)
    assert len(store.rebuild_index().entries) == 1
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    for owner in ("alice", "bob"):
        page = DocumentPage.model_validate_json(
            client.get("/api/documents", params={"owner": owner}).content
        )
        assert [doc.id for doc in page.items] == [document.id]

    edit = {
        "revision": updated.revision,
        "title": "ARD fee registration letter",
        "owner_ids": ["alice", "bob"],
        "document_date": None,
        "summary": "Shared registration",
        "text": "Corrected text",
        "tag_ids": ["utilities"],
    }
    for owners in ([], ["alice", "alice"], ["alice", "unknown"], ["missing"]):
        invalid = client.put(
            f"/api/documents/{document.id}", json=edit | {"owner_ids": owners}
        )
        assert invalid.status_code == 422
    assert store.get_document(document.id) == updated
    response = client.put(f"/api/documents/{document.id}", json=edit)
    response.raise_for_status()
    updated = DocumentDetail.model_validate_json(response.content).document
    for path in copies:
        assert (
            Document.model_validate(
                tomllib.loads(path.with_suffix(".toml").read_text())
            )
            == updated
        )
    assert rename_documents(store) == 1
    renamed = store.get_document(document.id)
    assert "ard-fee-registration-letter" in renamed.final_path
    assert all(not path.exists() for path in copies)
    assert all((tmp_path / path).exists() for path in renamed.file_paths)

    result = client.delete(
        "/api/catalog/owners/alice", params={"reassign_to": "unknown"}
    )
    result.raise_for_status()
    final = FileStorage(tmp_path).get_document(document.id)
    assert final.owner_ids == ["bob"]
    assert final.final_path.startswith("documents/bob/")
    assert not list((tmp_path / "documents/alice").glob("*"))
    assert not list((tmp_path / "documents/unknown").glob("*"))
    assert len(store.list_documents()) == 1
    assert file_hash(store.scan_path(scan.id, "original.pdf")) == original_hash


def test_rotation_uses_one_ocr_run_and_is_not_reapplied_on_filing_retry(
    tmp_path: Path,
) -> None:
    class OrientationInference(FixtureInference):
        async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
            return Analysis(
                documents=[
                    DocumentProposal(
                        pages=[1, 2, 3],
                        title="TK cover information request",
                        confidence=1,
                    )
                ],
                page_rotations=[
                    PageRotation(page=1, clockwise=180),
                    PageRotation(page=2, clockwise=180),
                ],
            )

    class CountingOCR(FixtureOCR):
        calls = 0

        def searchable(
            self,
            source: bytes,
            languages: str,
            *,
            rotations: list[PageRotation] | None = None,
        ) -> SearchableDocument:
            self.calls += 1
            assert rotations == [
                PageRotation(page=1, clockwise=180),
                PageRotation(page=2, clockwise=180),
            ]
            return super().searchable(source, languages, rotations=rotations)

    store = FileStorage(tmp_path)
    source = tmp_path / "inbox/mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    ocr = CountingOCR()
    asyncio.run(process_scan(store, OrientationInference(), ocr, scan))
    completed = store.get_scan(scan.id)
    assert completed.status == "complete"
    document = store.list_documents()[0]
    assert [
        page.rotation for page in PdfReader(tmp_path / document.final_path).pages
    ] == [180, 180, 0]
    digest = file_hash(tmp_path / document.final_path)
    completed.phase = "file"
    completed.status = "queued"
    store.save_scan(completed)
    asyncio.run(process_scan(store, OrientationInference(), ocr, completed))
    assert ocr.calls == 1
    assert file_hash(tmp_path / document.final_path) == digest
    assert [
        page.rotation
        for page in PdfReader(store.scan_path(scan.id, "original.pdf")).pages
    ] == [0, 0, 0]


def test_legacy_owner_metadata_remains_readable_without_migration(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    metadata = tmp_path / "documents/alice/legacy.toml"
    metadata.parent.mkdir()
    metadata.write_text("""id = "legacy"
scan_id = "scan"
source_pages = [1]
owner_id = "alice"
title = "Existing letter"
document_date = 2026-10-06
date_source = "document"
scanned_at = 2026-10-06T12:00:00Z
final_path = "documents/alice/legacy.pdf"
""")
    document = store.get_document("legacy")
    assert document.owner_ids == ["alice"]
    assert len(store.list_documents()) == 1
    store.save_document(document)
    saved = tomllib.loads(metadata.read_text())
    assert "owner_id" not in saved
    assert FileStorage(tmp_path).get_document("legacy").owner_ids == ["alice"]
