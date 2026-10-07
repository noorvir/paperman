from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry, PageRotation
from pypdf import PdfReader
from test_document_edit import create_document

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentEdit
from paperman.config import Settings
from paperman.storage import FileStorage, file_hash, write_record


def test_rotation_save_preserves_text_copies_and_rejects_stale_edits(
    tmp_path: Path,
) -> None:
    storage = FileStorage(tmp_path)
    doc = create_document(storage)
    catalog = storage.catalog()
    catalog.owners.extend(
        [CatalogEntry(id="alice", name="Alice"), CatalogEntry(id="bob", name="Bob")]
    )
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / doc.final_path
    original = tmp_path / "original.pdf"
    original.write_bytes(source.read_bytes())
    original_hash = file_hash(original)
    original_text = [page.extract_text() for page in PdfReader(original).pages]
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    edit = DocumentEdit(
        revision=doc.revision,
        title=doc.title,
        owner_ids=["alice", "bob"],
        document_date=None,
        summary=doc.summary,
        tag_ids=doc.generated_tags,
        text=storage.document_text(doc),
        rotations=[
            PageRotation(page=1, clockwise=180),
            PageRotation(page=3, clockwise=90),
        ],
    )
    for rotations in [
        [PageRotation(page=4, clockwise=90)],
        [PageRotation(page=1, clockwise=90), PageRotation(page=1, clockwise=180)],
    ]:
        invalid = edit.model_copy(update={"rotations": rotations})
        response = client.put(
            f"/api/documents/{doc.id}", json=invalid.model_dump(mode="json")
        )
        assert response.status_code == 422
        assert file_hash(source) == original_hash
        assert storage.get_document(doc.id).revision == 0

    response = client.put(f"/api/documents/{doc.id}", json=edit.model_dump(mode="json"))
    assert response.status_code == 200
    updated = DocumentDetail.model_validate_json(response.content).document
    hashes = set[str]()
    for path in updated.file_paths:
        pdf = tmp_path / path
        pages = PdfReader(pdf).pages
        assert [page.rotation for page in pages] == [180, 0, 90]
        assert [page.extract_text() for page in pages] == original_text
        hashes.add(file_hash(pdf))
    assert len(hashes) == 1
    assert storage.document_text(updated) == edit.text
    assert file_hash(original) == original_hash
    assert updated.manual_rotations == edit.rotations
    assert (
        client.put(
            f"/api/documents/{doc.id}", json=edit.model_dump(mode="json")
        ).status_code
        == 409
    )
    assert file_hash(tmp_path / updated.final_path) in hashes

    undo = edit.model_copy(
        update={
            "revision": updated.revision,
            "rotations": [
                PageRotation(page=1, clockwise=180),
                PageRotation(page=3, clockwise=270),
            ],
        }
    )
    response = client.put(f"/api/documents/{doc.id}", json=undo.model_dump(mode="json"))
    assert response.status_code == 200
    updated = storage.get_document(doc.id)
    assert updated.manual_rotations == []
    assert [
        page.rotation % 360 for page in PdfReader(tmp_path / updated.final_path).pages
    ] == [0, 0, 0]
