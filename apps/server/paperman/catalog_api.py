from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from paperman_parser.models import Catalog, CatalogEntry, Identifier

from paperman.api_models import EntryInput, EntryRemoval
from paperman.models import Event
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
                id=f"{slug(name)}-{uuid4().hex[:8]}",
                name=name,
                aliases=value.aliases,
                icon=value.icon,
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
                    entry.icon = value.icon
                    write_record(storage.root / "catalog.toml", catalog)
                    return entry
            raise FileNotFoundError()

    @router.delete("/api/catalog/{kind}/{entry_id}", operation_id="delete_entry")
    def delete_entry(
        kind: Literal["owners", "tags"],
        entry_id: Identifier,
        reassign_to: Identifier | None = None,
    ) -> EntryRemoval:
        with storage.transaction():
            if kind == "owners" and entry_id == "unknown":
                raise ValueError("The Unknown owner is required")
            catalog = storage.catalog()
            entries = catalog.owners if kind == "owners" else catalog.tags
            filtered = [entry for entry in entries if entry.id != entry_id]
            if len(filtered) == len(entries):
                raise FileNotFoundError()

            documents = storage.list_documents(include_unpublished=True)
            scans = storage.list_scans()
            affected_documents = []
            affected_scans = []
            if kind == "owners":
                if reassign_to is not None and not any(
                    owner.id == reassign_to for owner in filtered
                ):
                    raise ValueError("Select a different, existing owner")
                affected_documents = [
                    document for document in documents if entry_id in document.owner_ids
                ]
                affected_scans = [
                    scan
                    for scan in scans
                    if scan.proposal
                    and any(
                        entry_id in doc.owner_ids for doc in scan.proposal.documents
                    )
                ]
                if (affected_documents or affected_scans) and reassign_to is None:
                    return EntryRemoval(
                        status="in_use",
                        documents=len(affected_documents),
                        scans=len(affected_scans),
                    )
                # A running worker holds a catalog snapshot until its scan finishes.
                if any(scan.status == "running" for scan in scans):
                    raise HTTPException(
                        409,
                        "Scans are being processed. Try again when processing finishes",
                    )
                if reassign_to is not None:
                    for document in affected_documents:
                        remaining = set(document.owner_ids) - {entry_id}
                        remaining.add(reassign_to)
                        if len(remaining) > 1:
                            remaining.discard("unknown")
                        document.owner_ids = sorted(remaining)
                        document.revision += 1
                        document.history.append(
                            Event(
                                stage="ownership",
                                message=f"Owner reassigned from {entry_id} to {reassign_to}",
                            )
                        )
                        storage.save_document(document)
                    for scan in affected_scans:
                        if scan.proposal is None:
                            continue
                        for document in scan.proposal.documents:
                            if entry_id in document.owner_ids:
                                remaining = set(document.owner_ids) - {entry_id}
                                remaining.add(reassign_to)
                                if len(remaining) > 1:
                                    remaining.discard("unknown")
                                document.owner_ids = sorted(remaining)
                        scan.history.append(
                            Event(
                                stage="ownership",
                                message=f"Owner reassigned from {entry_id} to {reassign_to}",
                            )
                        )
                        storage.save_scan(scan)
                catalog.owners = filtered
            else:
                if reassign_to is not None:
                    raise ValueError("Only owners can be reassigned")
                if any(
                    entry_id in document.user_tags + document.generated_tags
                    for document in documents
                ):
                    raise ValueError("This entry is used by a filed document")
                catalog.tags = filtered
            # Keep the owner available until every reference has been updated.
            write_record(storage.root / "catalog.toml", catalog)
        return EntryRemoval(
            status="removed",
            documents=len(affected_documents),
            scans=len(affected_scans),
        )

    return router
