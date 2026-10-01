from typing import Literal
from uuid import uuid4

from fastapi import APIRouter

from paperman.api_models import ActionResult, EntryInput
from paperman.models import Catalog, CatalogEntry, Identifier
from paperman.storage import FileStorage, slug, write_record


def routes(storage: FileStorage) -> APIRouter:
    router = APIRouter()

    @router.get("/api/catalog", operation_id="catalog")
    def catalog() -> Catalog:
        return storage.catalog()

    @router.post("/api/catalog/{kind}", operation_id="create_entry")
    def create_entry(
        kind: Literal["owners", "tags"], value: EntryInput
    ) -> CatalogEntry:
        with storage.transaction():
            catalog = storage.catalog()
            entries = catalog.owners if kind == "owners" else catalog.tags
            name = value.name.strip()
            if not name or any(
                entry.name.casefold() == name.casefold() for entry in entries
            ):
                raise ValueError("Use a unique, non-empty name")
            entry = CatalogEntry(
                id=f"{slug(name)}-{uuid4().hex[:8]}", name=name, aliases=value.aliases
            )
            entries.append(entry)
            write_record(storage.root / "catalog.toml", catalog)
            return entry

    @router.put("/api/catalog/{kind}/{entry_id}", operation_id="update_entry")
    def update_entry(
        kind: Literal["owners", "tags"], entry_id: Identifier, value: EntryInput
    ) -> CatalogEntry:
        with storage.transaction():
            catalog = storage.catalog()
            entries = catalog.owners if kind == "owners" else catalog.tags
            if any(
                entry.name.casefold() == value.name.strip().casefold()
                and entry.id != entry_id
                for entry in entries
            ):
                raise ValueError("This name is already in use")
            for entry in entries:
                if entry.id == entry_id:
                    entry.name = value.name.strip()
                    entry.aliases = value.aliases
                    write_record(storage.root / "catalog.toml", catalog)
                    return entry
            raise FileNotFoundError()

    @router.delete("/api/catalog/{kind}/{entry_id}", operation_id="delete_entry")
    def delete_entry(
        kind: Literal["owners", "tags"], entry_id: Identifier
    ) -> ActionResult:
        with storage.transaction():
            if entry_id == "unknown":
                raise ValueError("The Unknown owner is required")
            for document in storage.list_documents():
                used = (
                    document.owner_id == entry_id
                    if kind == "owners"
                    else entry_id in document.user_tags + document.generated_tags
                )
                if used:
                    raise ValueError("This entry is used by a filed document")
            for scan in storage.list_scans():
                if (
                    kind == "owners"
                    and scan.proposal
                    and any(doc.owner_id == entry_id for doc in scan.proposal.documents)
                ):
                    raise ValueError("This owner is used by a scan proposal")
            catalog = storage.catalog()
            entries = catalog.owners if kind == "owners" else catalog.tags
            filtered = [entry for entry in entries if entry.id != entry_id]
            if len(filtered) == len(entries):
                raise FileNotFoundError()
            if kind == "owners":
                catalog.owners = filtered
            else:
                catalog.tags = filtered
            write_record(storage.root / "catalog.toml", catalog)
        return ActionResult(message="Entry removed")

    return router
