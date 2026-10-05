import asyncio
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import Catalog, Enrichment
from test_pipeline import FixtureInference, create_pdf

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentEdit, DocumentPage
from paperman.config import Settings
from paperman.models import Document
from paperman.pipeline import enrich_document
from paperman.storage import FileStorage, file_hash


def create_document(storage: FileStorage) -> Document:
    timestamp = datetime(2026, 9, 30, tzinfo=UTC)
    doc = Document(
        id="document",
        scan_id="scan",
        source_pages=[1, 2, 3],
        owner_id="unknown",
        title="Original title",
        document_date=timestamp.date(),
        date_source="scan_fallback",
        scanned_at=timestamp,
        final_path="documents/unknown/original.pdf",
        summary="Generated summary",
        generated_tags=["invoice"],
    )
    storage.save_document(doc)
    create_pdf(storage.root / doc.final_path)
    (storage.root / doc.final_path).with_suffix(".txt").write_text("Original OCR")
    storage.rebuild_index()
    return doc


def test_document_edits_are_atomic_searchable_and_survive_enrichment(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    pdf_hash = file_hash(tmp_path / doc.final_path)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    edit = DocumentEdit(
        revision=0,
        title="Corrected title",
        owner_id="unknown",
        document_date=None,
        summary="My factual summary",
        tag_ids=["health"],
        text="Corrected searchable text",
    )
    invalid = edit.model_copy(update={"owner_id": "missing"})
    assert (
        client.put(
            f"/api/documents/{doc.id}", json=invalid.model_dump(mode="json")
        ).status_code
        == 422
    )
    assert store.get_document(doc.id).revision == 0
    response = client.put(f"/api/documents/{doc.id}", json=edit.model_dump(mode="json"))
    assert response.status_code == 200
    detail = DocumentDetail.model_validate_json(response.content)
    assert detail.document.revision == 1
    assert detail.document.date_source == "scan_fallback"
    assert detail.document.document_date == doc.scanned_at.date()
    assert detail.document.history[-1].stage == "edit"
    assert detail.text == edit.text
    assert (
        client.put(
            f"/api/documents/{doc.id}", json=edit.model_dump(mode="json")
        ).status_code
        == 409
    )

    # Edits must be searchable before the background worker rebuilds the index.
    found = DocumentPage.model_validate_json(
        client.get("/api/documents?q=corrected+searchable").content
    )
    assert [item.id for item in found.items] == [doc.id]
    assert not DocumentPage.model_validate_json(
        client.get("/api/documents?q=Original+OCR").content
    ).items
    asyncio.run(enrich_document(store, FixtureInference(), store.get_document(doc.id)))
    restored = FileStorage(tmp_path)
    updated = restored.get_document(doc.id)
    assert updated.summary == edit.summary
    assert updated.user_tags == ["health"]
    assert "invoice" in updated.excluded_tags
    assert updated.final_path == doc.final_path
    assert updated.title == edit.title
    assert restored.document_text(updated) == edit.text
    assert file_hash(tmp_path / doc.final_path) == pdf_hash
    assert (tmp_path / doc.final_path).with_suffix(".txt").read_text() == "Original OCR"
    assert restored.rebuild_index().entries[0].text == edit.text


class EditingInference(FixtureInference):
    def __init__(self, client: TestClient, document: Document) -> None:
        self.client = client
        self.document = document

    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
        assert source.startswith(b"%PDF-")
        doc = self.document
        value = DocumentEdit(
            revision=doc.revision,
            title=doc.title,
            owner_id=doc.owner_id,
            document_date=None,
            summary=doc.summary,
            tag_ids=["invoice"],
            text="New corrected input",
        )
        self.client.put(
            f"/api/documents/{doc.id}", json=value.model_dump(mode="json")
        ).raise_for_status()
        return Enrichment(tag_ids=["invoice"], summary="Summary from page images")


def test_text_edit_during_inference_preserves_corrections(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    asyncio.run(enrich_document(store, EditingInference(client, doc), doc))
    updated = store.get_document(doc.id)
    assert updated.enrichment_status == "complete"
    assert updated.summary == "Summary from page images"
    assert store.document_text(updated) == "New corrected input"
