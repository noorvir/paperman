import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from paperman_parser.inference import EndpointInference
from paperman_parser.models import Analysis, Catalog, CatalogEntry, DocumentProposal
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.config import Settings
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, write_record


def test_feedback_returns_a_draft_without_filing_or_replacing_saved_proposal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "inbox" / "mail.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    saved = store.get_scan(scan.id)
    assert saved.proposal is not None
    draft = saved.proposal.model_copy(deep=True)
    draft.documents[0].title = "Manual title"
    revised = Analysis(
        documents=[
            DocumentProposal(
                pages=[1, 2, 3],
                owner_id="alice",
                title="Manual title",
                confidence=1,
            )
        ]
    )

    async def revise(
        self: EndpointInference,
        source: bytes,
        catalog: Catalog,
        proposal: Analysis,
        instructions: str,
    ) -> Analysis:
        assert source.startswith(b"%PDF-")
        assert any(owner.id == "alice" for owner in catalog.owners)
        assert proposal == draft
        assert instructions == "Keep all pages together. Preserve my title."
        return revised

    monkeypatch.setattr(EndpointInference, "revise", revise)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    body = {
        "proposal": draft.model_dump(mode="json"),
        "instructions": "Keep all pages together. Preserve my title.",
    }
    response = client.post(f"/api/scans/{scan.id}/review", json=body)
    assert response.status_code == 200
    assert Analysis.model_validate_json(response.content) == revised
    assert store.get_scan(scan.id) == saved
    assert store.list_documents() == []
    assert store.scan_path(scan.id, "original.pdf").read_bytes() == source.read_bytes()

    async def unavailable(
        self: EndpointInference,
        source: bytes,
        catalog: Catalog,
        proposal: Analysis,
        instructions: str,
    ) -> Analysis:
        raise ValueError("Cannot reach the model endpoint")

    monkeypatch.setattr(EndpointInference, "revise", unavailable)
    assert client.post(f"/api/scans/{scan.id}/review", json=body).status_code == 422
    assert store.get_scan(scan.id) == saved
    assert store.list_documents() == []

    saved.status = "running"
    store.save_scan(saved)
    assert client.post(f"/api/scans/{scan.id}/review", json=body).status_code == 409
