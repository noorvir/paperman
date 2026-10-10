import asyncio
from pathlib import Path

from fastapi.testclient import TestClient
from paperman_parser.models import (
    Analysis,
    Catalog,
    CatalogEntry,
    Creator,
    DocumentProposal,
    Enrichment,
)
from test_auth import SECRET, identity
from test_document_edit import create_document
from test_pipeline import FixtureInference, FixtureOCR, create_pdf

from paperman.api import create_app
from paperman.api_models import DocumentDetail, DocumentEdit, DocumentPage
from paperman.auth import AuthSettings
from paperman.config import Settings
from paperman.filing import file_documents
from paperman.models import Verification, now
from paperman.pipeline import enrich_document, process_scan
from paperman.storage import FileStorage, file_hash, write_record


class CreatorEnrichment(FixtureInference):
    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
        return Enrichment(
            creators=[Creator(name="New detected creator")],
            tag_ids=[],
            summary="Updated summary",
        )


class CreatorInference(FixtureInference):
    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
        return Analysis(
            documents=[
                DocumentProposal(
                    pages=[1],
                    title="Research findings",
                    confidence=1,
                    creators=[
                        Creator(catalog_id="alice", name="Alice Smith"),
                        Creator(name="Bob Jones"),
                    ],
                ),
                DocumentProposal(
                    pages=[2],
                    title="Energy bill",
                    confidence=1,
                    creators=[
                        Creator(name="Example Energy GmbH", aliases=["EE"]),
                    ],
                ),
                DocumentProposal(
                    pages=[3],
                    title="Energy payment reminder",
                    confidence=1,
                    creators=[
                        Creator(name="EE"),
                        Creator(name="Example Energy"),
                    ],
                ),
            ]
        )


def test_filing_reuses_directory_ids_and_keeps_multiple_creators(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice Smith"))
    write_record(store.root / "catalog.toml", catalog)
    source = store.root / "inbox" / "scan.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    asyncio.run(process_scan(store, CreatorInference(), FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    assert scan.status == "complete"
    documents = [store.get_document(id) for id in scan.document_ids]
    assert documents[0].creator_ids[0] == "alice"
    assert len(documents[0].creator_ids) == 2
    assert documents[1].creator_ids == documents[2].creator_ids
    assert len(documents[1].creator_ids) == 1
    assert all(document.owner_ids == ["unknown"] for document in documents)
    assert all(document.delivery_confirmation is None for document in documents)
    directory = FileStorage(tmp_path).catalog().directory
    assert len(directory) == 3
    assert {entry.name for entry in directory} == {
        "Alice Smith",
        "Bob Jones",
        "Example Energy GmbH",
    }
    # Retrying a filing checkpoint must not create another entity or change its IDs.
    file_documents(store, scan)
    assert [store.get_document(id).creator_ids for id in scan.document_ids] == [
        doc.creator_ids for doc in documents
    ]
    assert len(store.catalog().directory) == 3


def test_creator_edits_filtering_and_aliases_do_not_change_routing(
    tmp_path: Path,
) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    doc.delivery_confirmation = Verification(at=now(), by="Admin")
    store.save_document(doc)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.post(
        "/api/catalog/creators",
        json={"name": "TK", "aliases": ["Techniker Krankenkasse"]},
    )
    response.raise_for_status()
    entry = CatalogEntry.model_validate_json(response.content)
    assert (
        client.post(
            "/api/catalog/creators", json={"name": "Techniker Krankenkasse"}
        ).status_code
        == 422
    )
    assert (
        client.post("/api/catalog/creators", json={"name": "TK GmbH"}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/catalog/creators", json={"name": "Other", "aliases": ["TK"]}
        ).status_code
        == 422
    )
    pdf_hash = file_hash(store.root / doc.final_path)
    edit = DocumentEdit(
        revision=doc.revision,
        title=doc.title,
        owner_ids=doc.owner_ids,
        creator_ids=[entry.id],
        document_date=None,
        summary=doc.summary,
        tag_ids=doc.generated_tags,
        text="Original OCR",
    )
    response = client.put(f"/api/documents/{doc.id}", json=edit.model_dump(mode="json"))
    response.raise_for_status()
    updated = DocumentDetail.model_validate_json(response.content).document
    assert updated.creator_ids == [entry.id]
    assert updated.delivery_confirmation == doc.delivery_confirmation
    assert updated.pdf_revision == doc.pdf_revision
    assert updated.owner_ids == doc.owner_ids
    for query in [f"creator={entry.id}", "q=Techniker", "sort=creators_desc"]:
        result = DocumentPage.model_validate_json(
            client.get(f"/api/documents?{query}").content
        )
        assert [item.id for item in result.items] == [doc.id]
    assert not DocumentPage.model_validate_json(
        client.get("/api/documents?creator=absent").content
    ).items
    edit.creator_ids = ["missing"]
    edit.revision = updated.revision
    assert (
        client.put(
            f"/api/documents/{doc.id}", json=edit.model_dump(mode="json")
        ).status_code
        == 422
    )
    asyncio.run(enrich_document(store, CreatorEnrichment(), store.get_document(doc.id)))
    assert FileStorage(tmp_path).get_document(doc.id).creator_ids == [entry.id]
    assert file_hash(store.root / doc.final_path) == pdf_hash
    # Removing an owner role must preserve the same identity when used as Creator.
    response = client.post(
        "/api/catalog/owners", json={"name": "Techniker Krankenkasse"}
    )
    response.raise_for_status()
    assert CatalogEntry.model_validate_json(response.content).id == entry.id
    client.delete(f"/api/catalog/owners/{entry.id}").raise_for_status()
    assert store.get_document(doc.id).creator_ids == [entry.id]
    assert store.catalog().creators[0].id == entry.id
    edit.revision = store.get_document(doc.id).revision
    edit.creator_ids = []
    client.put(
        f"/api/documents/{doc.id}", json=edit.model_dump(mode="json")
    ).raise_for_status()
    assert FileStorage(tmp_path).get_document(doc.id).creator_ids == []
    asyncio.run(enrich_document(store, CreatorEnrichment(), store.get_document(doc.id)))
    assert FileStorage(tmp_path).get_document(doc.id).creator_ids == []


def test_creator_catalog_is_limited_to_visible_documents(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    catalog = store.catalog()
    catalog.creators = [
        CatalogEntry(id="visible", name="Visible author"),
        CatalogEntry(id="hidden", name="Private author"),
    ]
    write_record(store.root / "catalog.toml", catalog)
    doc.creator_ids = ["visible"]
    doc.access_user_ids = ["alice-user"]
    store.save_document(doc)
    client = TestClient(
        create_app(
            Settings(data_dir=tmp_path),
            AuthSettings(auth_enabled=True, api_auth_secret=SECRET),
        )
    )
    member = identity([])
    catalog = Catalog.model_validate_json(
        client.get("/api/catalog", headers=member).content
    )
    assert [entry.id for entry in catalog.creators] == ["visible"]
    assert (
        client.post(
            "/api/catalog/creators", headers=member, json={"name": "New"}
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/documents/{doc.id}", headers=identity([], subject="other-user")
        ).status_code
        == 404
    )

    edit = DocumentEdit(
        revision=doc.revision,
        title=doc.title,
        owner_ids=doc.owner_ids,
        creator_ids=["hidden"],
        document_date=None,
        summary=doc.summary,
        tag_ids=doc.generated_tags,
        text="Original OCR",
    )
    assert (
        client.put(
            f"/api/documents/{doc.id}",
            headers=member,
            json=edit.model_dump(mode="json"),
        ).status_code
        == 422
    )
    edit.creator_ids = []
    response = client.put(
        f"/api/documents/{doc.id}", headers=member, json=edit.model_dump(mode="json")
    )
    response.raise_for_status()
    assert (
        DocumentDetail.model_validate_json(response.content).document.creator_ids == []
    )


def test_creator_merge_preserves_metadata_and_alias_lookup(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    doc = create_document(store)
    catalog = store.catalog()
    catalog.creators = [
        CatalogEntry(id="tk", name="TK"),
        CatalogEntry(id="full", name="Techniker Krankenkasse"),
    ]
    write_record(store.root / "catalog.toml", catalog)
    doc.creator_ids = ["full", "tk"]
    store.save_document(doc)
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.delete("/api/catalog/creators/full")
    assert response.json()["status"] == "in_use"
    client.delete("/api/catalog/creators/full?reassign_to=tk").raise_for_status()
    assert FileStorage(tmp_path).get_document(doc.id).creator_ids == ["tk"]
    assert store.catalog().creators[0].aliases == ["Techniker Krankenkasse"]
    assert (
        client.post(
            "/api/catalog/creators", json={"name": "Techniker Krankenkasse"}
        ).status_code
        == 422
    )


class ConflictingCreatorInference(CreatorInference):
    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
        result = await super().analyze(source, catalog)
        result.documents[0].creators = [
            Creator(name="Alice Smith", aliases=["Bob Jones"])
        ]
        return result


def test_ambiguous_creator_can_be_corrected_in_scan_review(tmp_path: Path) -> None:
    store = FileStorage(tmp_path)
    catalog = store.catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice Smith"))
    catalog.creators.append(CatalogEntry(id="bob", name="Bob Jones"))
    write_record(store.root / "catalog.toml", catalog)
    source = store.root / "inbox" / "scan.pdf"
    create_pdf(source)
    scan = store.ingest(source)
    inference = ConflictingCreatorInference()
    asyncio.run(process_scan(store, inference, FixtureOCR(), scan))
    scan = store.get_scan(scan.id)
    assert scan.status == "review"
    assert scan.proposal is not None
    assert store.list_documents() == []
    scan.proposal.documents[0].creators = [
        Creator(catalog_id="alice", name="Alice Smith")
    ]
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.put(
        f"/api/scans/{scan.id}/review", json=scan.proposal.model_dump(mode="json")
    )
    response.raise_for_status()
    asyncio.run(process_scan(store, inference, FixtureOCR(), store.get_scan(scan.id)))
    completed = store.get_scan(scan.id)
    assert completed.status == "complete"
    assert store.get_document(completed.document_ids[0]).creator_ids == ["alice"]
