from datetime import UTC, date, datetime
from pathlib import Path

from fastapi.testclient import TestClient

from paperman.api import create_app
from paperman.api_models import DocumentPage
from paperman.config import Settings
from paperman.models import Document
from paperman.storage import FileStorage


def test_document_filters_combine_multiple_values_and_paginate(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    for number in range(30):
        document = Document(
            id=f"document-{number:02}",
            scan_id="scan",
            source_pages=[number + 1],
            owner_id="alice" if number % 2 else "bob",
            title=f"Bill {number:02}",
            document_date=date(2026, 9, number + 1),
            date_source="document",
            scanned_at=datetime(2026, 10, 1, tzinfo=UTC),
            final_path=f"documents/test/document-{number:02}.pdf",
            generated_tags=["invoice", "utilities"],
            excluded_tags=["utilities"] if number % 3 == 0 else [],
            user_tags=["health"] if number % 3 == 0 else [],
            enrichment_status="complete",
        )
        store.save_document(document)
        (tmp_path / document.final_path).with_suffix(".txt").write_text("Electricity")
    client = TestClient(create_app(Settings(data_dir=tmp_path)))

    response = client.get(
        "/api/documents?owner=alice&owner=bob&tag=utilities&tag=health&sort=title"
    )
    assert response.status_code == 200
    page = DocumentPage.model_validate_json(response.content)
    assert (page.total, page.pages, len(page.items)) == (30, 2, 25)
    second = DocumentPage.model_validate_json(
        client.get(
            "/api/documents?owner=alice&owner=bob&tag=utilities&tag=health&sort=title&page=2"
        ).content
    )
    assert [item.id for item in second.items] == [
        f"document-{i:02}" for i in range(25, 30)
    ]

    filtered = DocumentPage.model_validate_json(
        client.get(
            "/api/documents?owner=alice&tag=utilities&tag=health"
            "&after=2026-09-10&before=2026-09-16&q=electricity&status=complete&sort=date_asc"
        ).content
    )
    assert [item.id for item in filtered.items] == [
        "document-09",
        "document-11",
        "document-13",
        "document-15",
    ]

    # A removed AI tag must not count as a match, including within a multi-value filter.
    utilities = DocumentPage.model_validate_json(
        client.get(
            "/api/documents?owner=bob&owner=alice&tag=utilities&tag=missing"
        ).content
    )
    assert utilities.total == 20
    assert all(int(item.id.removeprefix("document-")) % 3 for item in utilities.items)
    assert (
        DocumentPage.model_validate_json(
            client.get("/api/documents?owner=missing&tag=invoice").content
        ).total
        == 0
    )
    assert (
        DocumentPage.model_validate_json(
            client.get("/api/documents?owner=&tag=").content
        ).total
        == 30
    )
    assert (
        DocumentPage.model_validate_json(
            client.get("/api/documents?after=2026-09-10&before=2026-09-10").content
        ).total
        == 1
    )
    assert (
        client.get("/api/documents?after=2026-09-20&before=2026-09-10").status_code
        == 422
    )
