import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import CatalogEntry
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import ScanDetail
from paperman.config import Settings
from paperman.models import Scan
from paperman.pipeline import process_scan
from paperman.storage import FileStorage, write_record


def test_upload_is_available_before_worker_and_duplicates_keep_progress(
    tmp_path: Path,
) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice Smith"))
    write_record(tmp_path / "catalog.toml", catalog)
    source = tmp_path / "letter.pdf"
    create_pdf(source)
    payload = source.read_bytes()

    response = client.post(
        "/api/uploads", files={"file": (source.name, payload, "application/pdf")}
    )
    assert response.status_code == 200
    scan = Scan.model_validate_json(response.content)
    assert scan.status == "queued"
    assert scan.timestamp_source == "upload"
    detail = ScanDetail.model_validate_json(client.get(f"/api/scans/{scan.id}").content)
    assert detail.pipeline[0].id == "inbox"
    assert client.get(f"/api/scans/{scan.id}/pdf").content == payload
    assert (tmp_path / "state" / "wake").exists()

    # Processing can start from the returned record without another inbox intake.
    asyncio.run(process_scan(store, FixtureInference(), FixtureOCR(), scan))
    processed = store.get_scan(scan.id)
    assert processed.status == "review"
    assert processed.page_count == 3

    response = client.post(
        "/api/uploads", files={"file": ("copy.pdf", payload, "application/pdf")}
    )
    assert response.status_code == 200
    duplicate = Scan.model_validate_json(response.content)
    assert duplicate.id == scan.id
    assert duplicate.status == processed.status
    assert duplicate.proposal == processed.proposal
    assert duplicate.scanned_at == scan.scanned_at
    assert len(store.list_scans()) == 1
    assert len(list((tmp_path / "inbox").iterdir())) == 1
    assert client.get(f"/api/scans/{scan.id}/pdf").content == payload


def test_rejected_uploads_leave_no_scan_or_inbox_file(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path, max_upload_mb=1)))
    for filename, payload, status in [
        ("letter.txt", b"not a PDF", 422),
        ("letter.pdf", b"not a PDF", 422),
        ("partial.pdf", b"%PDF-1.7\nincomplete", 422),
        ("large.pdf", b"%PDF-1.7\n" + b" " * (1024 * 1024), 413),
    ]:
        response = client.post(
            "/api/uploads", files={"file": (filename, payload, "application/pdf")}
        )
        assert response.status_code == status
        assert list((tmp_path / "inbox").iterdir()) == []
        assert FileStorage(tmp_path).list_scans() == []
