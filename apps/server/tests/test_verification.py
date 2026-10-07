import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from test_document_edit import create_document
from test_pipeline import FixtureInference

from paperman.api import create_app
from paperman.api_models import DocumentEdit
from paperman.config import Settings
from paperman.models import Document
from paperman.pipeline import enrich_document
from paperman.storage import FileStorage


def test_verification_is_persisted_once_and_survives_edits(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    assert doc.verification is None
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    url = f"/api/documents/{doc.id}/verify"
    assert (
        client.post(url, json={"revision": 9, "reviewer": "Alice"}).status_code == 409
    )
    assert client.post(url, json={"revision": 0, "reviewer": " "}).status_code == 422
    response = client.post(url, json={"revision": 0, "reviewer": "Alice"})
    response.raise_for_status()
    verified = Document.model_validate_json(response.content)
    assert verified.verification is not None
    assert verified.verification.by == "Alice"
    assert verified.revision == 1
    assert verified.history[-1].stage == "verify"
    assert (
        FileStorage(tmp_path).get_document(doc.id).verification == verified.verification
    )
    repeated = client.post(url, json={"revision": 0, "reviewer": "Bob"})
    repeated.raise_for_status()
    assert Document.model_validate_json(repeated.content) == verified

    edit = DocumentEdit(
        revision=verified.revision,
        title="Corrected title",
        owner_ids=doc.owner_ids,
        document_date=None,
        summary="Corrected summary",
        tag_ids=["health"],
        text="Corrected text",
    )
    client.put(
        f"/api/documents/{doc.id}", json=edit.model_dump(mode="json")
    ).raise_for_status()
    asyncio.run(enrich_document(store, FixtureInference(), store.get_document(doc.id)))
    assert store.get_document(doc.id).verification == verified.verification
