from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry, PageRotation
from paperman_parser.pdf import rotate_pages, select_pages
from pypdf import PdfReader
from test_document_edit import create_document

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentEdit, DocumentPage
from paperman.config import Settings
from paperman.models import Scan, Verification
from paperman.storage import FileStorage, file_hash, write_record


def test_page_selection_changes_only_current_document(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    source = tmp_path / doc.final_path
    original = source.read_bytes()
    scan = Scan(
        id=doc.scan_id,
        content_hash="test",
        original_name="scan.pdf",
        scanned_at=doc.scanned_at,
        arrivals=[],
        page_count=3,
        status="complete",
        phase="done",
        document_ids=[doc.id, "sibling"],
    )
    store.save_scan(scan)
    store.scan_path(scan.id, "original.pdf").write_bytes(original)
    store.scan_path(scan.id, "searchable.pdf").write_bytes(original)
    doc.source_pages = [1, 2]
    doc.manual_rotations = [PageRotation(page=2, clockwise=180)]
    doc.verification = Verification(by="Alice", at=doc.scanned_at)
    catalog = store.catalog()
    catalog.owners.extend(
        [CatalogEntry(id="alice", name="Alice"), CatalogEntry(id="bob", name="Bob")]
    )
    write_record(tmp_path / "catalog.toml", catalog)
    doc.owner_ids = ["alice", "bob"]
    source.write_bytes(
        rotate_pages(select_pages(original, [1, 2]), doc.manual_rotations)
    )
    source.with_suffix(".txt").write_text(
        "\n\f\n".join(page.extract_text() for page in PdfReader(source).pages)
    )
    store.save_document(doc)
    sibling = doc.model_copy(
        deep=True,
        update={
            "id": "sibling",
            "source_pages": [3],
            "manual_rotations": [],
            "owner_ids": ["unknown"],
            "final_path": "documents/unknown/sibling.pdf",
        },
    )
    sibling_path = tmp_path / sibling.final_path
    sibling_path.write_bytes(select_pages(original, [3]))
    sibling_path.with_suffix(".txt").write_text("Sibling text")
    store.save_document(sibling)
    immutable = [
        store.scan_path(scan.id, name)
        for name in ["original.pdf", "searchable.pdf", "scan.json"]
    ]
    immutable += [
        sibling_path.with_suffix(suffix) for suffix in [".pdf", ".txt", ".toml"]
    ]
    hashes = {path: file_hash(path) for path in immutable}
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    edit = DocumentEdit(
        revision=doc.revision,
        title=doc.title,
        owner_ids=doc.owner_ids,
        document_date=None,
        summary=doc.summary,
        tag_ids=doc.generated_tags,
        text=store.document_text(doc),
        source_pages=[2, 3],
        rotations=[PageRotation(page=2, clockwise=90)],
    )
    before = {tmp_path / path: file_hash(tmp_path / path) for path in doc.file_paths}
    for pages in [[], [2, 2], [0, 2], [2, 4], [4, 2]]:
        payload = edit.model_dump(mode="json")
        payload["source_pages"] = pages
        assert client.put(f"/api/documents/{doc.id}", json=payload).status_code == 422
        assert store.get_document(doc.id).revision == doc.revision
        assert {path: file_hash(path) for path in before} == before
    response = client.put(f"/api/documents/{doc.id}", json=edit.model_dump(mode="json"))
    assert response.status_code == 200
    result = DocumentDetail.model_validate_json(response.content)
    updated = result.document
    assert updated.id == doc.id
    assert updated.source_pages == [2, 3]
    assert updated.verification == doc.verification
    assert updated.summary == doc.summary
    assert updated.manual_rotations == [
        PageRotation(page=1, clockwise=180),
        PageRotation(page=2, clockwise=90),
    ]
    original_text = [page.extract_text() for page in PdfReader(BytesIO(original)).pages]
    assert result.text == "\n\f\n".join(original_text[1:])
    for path in updated.file_paths:
        reader = PdfReader(tmp_path / path)
        assert [page.rotation % 360 for page in reader.pages] == [180, 90]
        assert [page.extract_text() for page in reader.pages] == original_text[1:]
    assert {path: file_hash(path) for path in immutable} == hashes
    assert (
        client.put(
            f"/api/documents/{doc.id}", json=edit.model_dump(mode="json")
        ).status_code
        == 409
    )
    assert len(store.list_documents()) == 2
    index = store.rebuild_index()
    assert (
        next(entry.text for entry in index.entries if entry.document_id == doc.id)
        == result.text
    )

    # Reorder retained pages and insert a removed page between them.
    edit.source_pages = [3, 1, 2]
    edit.revision = updated.revision
    edit.rotations = []
    edit.text = "Explicit text correction"
    response = client.put(f"/api/documents/{doc.id}", json=edit.model_dump(mode="json"))
    assert response.status_code == 200
    result = DocumentDetail.model_validate_json(response.content)
    assert result.text == edit.text
    assert result.document.source_pages == [3, 1, 2]
    assert result.document.verification == doc.verification
    assert result.document.manual_rotations == [
        PageRotation(page=1, clockwise=90),
        PageRotation(page=3, clockwise=180),
    ]
    assert [
        page.rotation % 360
        for page in PdfReader(tmp_path / result.document.final_path).pages
    ] == [90, 0, 180]
    assert [
        page.extract_text()
        for page in PdfReader(tmp_path / result.document.final_path).pages
    ] == [original_text[2], original_text[0], original_text[1]]
    for file in result.document.file_paths:
        assert (tmp_path / file).with_suffix(".txt").read_text() == "\n\f\n".join(
            [original_text[2], original_text[0], original_text[1]]
        )
    assert {path: file_hash(path) for path in immutable} == hashes
    page = DocumentPage.model_validate_json(
        client.get("/api/documents?q=Explicit+text+correction").content
    )
    assert [item.id for item in page.items] == [doc.id]
