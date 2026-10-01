import asyncio
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from test_pipeline import FixtureInference, create_pdf

from paperman.api import create_app
from paperman.config import Settings
from paperman.models import Catalog, CatalogEntry, Document, Enrichment, Scan
from paperman.pipeline import enrich_document
from paperman.storage import FileStorage


def test_catalog_filters_and_review_validation(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.post(
        "/api/catalog/owners", json={"name": "Alice", "aliases": ["A Smith"]}
    )
    assert response.status_code == 200
    owner = CatalogEntry.model_validate_json(response.content)
    assert client.post("/api/catalog/owners", json={"name": "alice"}).status_code == 422
    assert client.delete("/api/catalog/owners/unknown").status_code == 422
    assert (
        client.put(
            f"/api/catalog/owners/{owner.id}", json={"name": "Alice Smith"}
        ).status_code
        == 200
    )
    catalog = Catalog.model_validate_json(client.get("/api/catalog").content)
    assert any(entry.name == "Alice Smith" for entry in catalog.owners)
    assert client.get("/api/documents?page=0").status_code == 422
    assert client.get("/api/documents?after=garbage").status_code == 422
    assert client.get("/api/scans/../../settings.toml").status_code == 404
    assert (
        client.post(
            "/api/uploads", files={"file": ("bad.pdf", b"not a PDF", "application/pdf")}
        ).status_code
        == 422
    )

    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    store = FileStorage(tmp_path)
    scan = store.ingest(source)
    scan.page_count = 3
    scan.status = "review"
    scan.phase = "file"
    store.save_scan(scan)
    invalid = {
        "documents": [
            {"pages": [1], "owner_id": owner.id, "title": "Bill", "confidence": 1}
        ]
    }
    assert client.put(f"/api/scans/{scan.id}/review", json=invalid).status_code == 422
    invalid["documents"][0]["pages"] = [1, 2, 3]
    response = client.put(f"/api/scans/{scan.id}/review", json=invalid)
    assert response.status_code == 200
    updated = Scan.model_validate_json(response.content)
    assert updated.status == "queued"
    assert client.put(f"/api/scans/{scan.id}/review", json=invalid).status_code == 409
    assert client.get(f"/api/scans/{scan.id}/pdf").content == source.read_bytes()


class CatalogChangingInference(FixtureInference):
    def __init__(self, client: TestClient) -> None:
        self.client = client

    async def enrich(self, text: str, catalog: Catalog) -> Enrichment:
        response = self.client.delete("/api/catalog/tags/invoice")
        response.raise_for_status()
        return Enrichment(tag_ids=["invoice"], summary="New summary")


def test_enrichment_preserves_state_when_catalog_changes(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    store = FileStorage(tmp_path)
    timestamp = datetime.now(UTC)
    document = Document(
        id="document",
        scan_id="scan",
        source_pages=[1],
        owner_id="unknown",
        title="Invoice",
        document_date=timestamp.date(),
        date_source="scan_fallback",
        scanned_at=timestamp,
        final_path="documents/unknown/invoice.pdf",
        generated_tags=["health"],
        user_tags=["utilities"],
        summary="Previous summary",
    )
    store.save_document(document)
    (tmp_path / document.final_path).with_suffix(".txt").write_text(
        "Invoice for 150 EUR"
    )

    asyncio.run(enrich_document(store, CatalogChangingInference(client), document))

    updated = store.get_document(document.id)
    assert all(tag.id != "invoice" for tag in store.catalog().tags)
    assert updated.enrichment_status == "failed"
    assert (
        updated.enrichment_error
        == "The tag catalog changed during processing. Retry tagging"
    )
    assert updated.generated_tags == ["health"]
    assert updated.user_tags == ["utilities"]
    assert updated.summary == "Previous summary"
