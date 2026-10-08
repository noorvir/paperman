from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from paperman_parser.models import Catalog, CatalogEntry

from paperman.api import create_app
from paperman.api_models import DocumentPage
from paperman.config import Settings
from paperman.models import Document, ModelSettings, Verification
from paperman.storage import FileStorage, write_record


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("date_asc", ["b", "c", "a"]),
        ("date_desc", ["a", "c", "b"]),
        ("title", ["b", "c", "a"]),
        ("title_desc", ["a", "c", "b"]),
        ("owners_asc", ["a", "c", "b"]),
        ("owners_desc", ["b", "c", "a"]),
        ("tags_asc", ["c", "a", "b"]),
        ("tags_desc", ["b", "a", "c"]),
        ("verification_asc", ["b", "a", "c"]),
        ("verification_desc", ["a", "c", "b"]),
        ("processed_asc", ["a", "c", "b"]),
        ("processed_desc", ["b", "c", "a"]),
    ],
)
def test_document_column_sorting(
    tmp_path: Path, sort: str, expected: list[str]
) -> None:
    store = FileStorage(tmp_path)
    write_record(
        tmp_path / "catalog.toml",
        Catalog(
            owners=[
                CatalogEntry(id="z", name="Aaron"),
                CatalogEntry(id="a", name="Zoe"),
                CatalogEntry(id="m", name="Mike"),
            ],
            tags=[
                CatalogEntry(id=id, name=name)
                for id, name in [
                    ("invoice", "Invoice"),
                    ("tax", "Tax"),
                    ("health", "Health"),
                    ("utilities", "Utilities"),
                ]
            ],
        ),
    )
    timestamp = datetime(2026, 10, 1, tzinfo=UTC)
    for id, title, owner, day, tags in [
        ("a", "Zebra", "z", 3, ["tax"]),
        ("b", "Alpha", "a", 1, ["utilities"]),
        ("c", "Middle", "m", 2, ["health", "invoice"]),
    ]:
        doc = Document(
            id=id,
            scan_id="scan",
            source_pages=[1],
            owner_ids=[owner],
            title=title,
            document_date=date(2026, 9, day),
            date_source="document",
            scanned_at=timestamp,
            final_path=f"documents/{owner}/{id}.pdf",
            generated_tags=["invoice"],
            excluded_tags=["invoice"],
            user_tags=tags,
            verification=None
            if id == "b"
            else Verification(by="unknown", at=timestamp),
            processed_at=None
            if id == "a"
            else datetime(2026, 10, 3 if id == "b" else 2, tzinfo=UTC),
        )
        store.save_document(doc)
        (tmp_path / doc.final_path).with_suffix(".txt").write_text("")
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.get("/api/documents", params={"sort": sort})
    assert response.status_code == 200
    page = DocumentPage.model_validate_json(response.content)
    assert [doc.id for doc in page.items] == expected


def test_time_format_defaults_and_persists(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    settings = ModelSettings.model_validate_json(client.get("/api/settings").content)
    assert settings.time_format == "24h"
    settings.time_format = "12h"
    assert (
        client.put("/api/settings", json=settings.model_dump(mode="json")).status_code
        == 200
    )
    restarted = TestClient(create_app(Settings(data_dir=tmp_path)))
    assert (
        ModelSettings.model_validate_json(
            restarted.get("/api/settings").content
        ).time_format
        == "12h"
    )
    invalid = settings.model_dump(mode="json")
    invalid["time_format"] = "other"
    assert client.put("/api/settings", json=invalid).status_code == 422
