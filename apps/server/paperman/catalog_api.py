from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from paperman_parser.models import Catalog, CatalogEntry, Identifier

from paperman.api_models import EntryInput, EntryRemoval
from paperman.auth import Auth, Principal
from paperman.catalog import matching_entries, visible_catalog
from paperman.models import Event
from paperman.storage import FileStorage, slug, write_record


def routes(storage: FileStorage, auth: Auth) -> APIRouter:
    router = APIRouter()

    @router.get("/api/catalog", operation_id="catalog")
    def catalog(principal: Annotated[Principal | None, Depends(auth)]) -> Catalog:
        return visible_catalog(storage, principal)

    @router.post(
        "/api/catalog/{kind}",
        operation_id="create_entry",
        dependencies=[Depends(auth.require_admin)],
    )
    def create_entry(
        kind: Literal["owners", "tags", "creators"], value: EntryInput
    ) -> CatalogEntry:
        with storage.transaction():
            catalog = storage.catalog()
            entries = {
                "owners": catalog.owners,
                "tags": catalog.tags,
                "creators": catalog.creators,
            }[kind]
            name = value.name.strip()
            if not name or any(
                entry.name.casefold() == name.casefold() for entry in entries
            ):
                raise ValueError("Use a unique, non-empty name")
            if kind != "tags":
                matches = matching_entries(catalog, name, value.aliases)
                if matches:
                    if (
                        kind == "owners"
                        and len(matches) == 1
                        and matches[0] in catalog.creators
                    ):
                        entry = matches[0]
                        catalog.creators.remove(entry)
                        catalog.owners.append(entry)
                        write_record(storage.root / "catalog.toml", catalog)
                        return entry
                    raise ValueError(
                        "This name or alias already exists in the directory. Use the existing entry"
                    )
            entry = CatalogEntry(
                id=f"{slug(name)[:60]}-{uuid4().hex[:8]}",
                name=name,
                aliases=value.aliases,
                icon=value.icon,
            )
            entries.append(entry)
            write_record(storage.root / "catalog.toml", catalog)
            return entry

    @router.put(
        "/api/catalog/{kind}/{entry_id}",
        operation_id="update_entry",
        dependencies=[Depends(auth.require_admin)],
    )
    def update_entry(
        kind: Literal["owners", "tags", "creators"],
        entry_id: Identifier,
        value: EntryInput,
    ) -> CatalogEntry:
        with storage.transaction():
            catalog = storage.catalog()
            entries = {
                "owners": catalog.owners,
                "tags": catalog.tags,
                "creators": catalog.creators,
            }[kind]
            if any(
                entry.name.casefold() == value.name.strip().casefold()
                and entry.id != entry_id
                for entry in entries
            ):
                raise ValueError("This name is already in use")
            if kind != "tags" and any(
                entry.id != entry_id
                for entry in matching_entries(catalog, value.name, value.aliases)
            ):
                raise ValueError(
                    "This name or alias already belongs to another directory entry"
                )
            for entry in entries:
                if entry.id == entry_id:
                    entry.name = value.name.strip()
                    entry.aliases = value.aliases
                    entry.icon = value.icon
                    write_record(storage.root / "catalog.toml", catalog)
                    return entry
            raise FileNotFoundError()

    @router.delete(
        "/api/catalog/{kind}/{entry_id}",
        operation_id="delete_entry",
        dependencies=[Depends(auth.require_admin)],
    )
    def delete_entry(
        kind: Literal["owners", "tags", "creators"],
        entry_id: Identifier,
        reassign_to: Identifier | None = None,
    ) -> EntryRemoval:
        with storage.transaction():
            if kind == "owners" and entry_id == "unknown":
                raise ValueError("The Unknown owner is required")
            catalog = storage.catalog()
            entries = {
                "owners": catalog.owners,
                "tags": catalog.tags,
                "creators": catalog.creators,
            }[kind]
            filtered = [entry for entry in entries if entry.id != entry_id]
            if len(filtered) == len(entries):
                raise FileNotFoundError()

            documents = storage.list_documents(include_unpublished=True)
            scans = storage.list_scans()
            affected_documents = []
            affected_scans = []
            if kind == "creators":
                if any(scan.status == "running" for scan in scans):
                    raise HTTPException(
                        409,
                        "Wait for scan processing to finish before changing the directory",
                    )
                affected_documents = [
                    doc for doc in documents if entry_id in doc.creator_ids
                ]
                affected_scans = [
                    scan
                    for scan in scans
                    if scan.proposal
                    and any(
                        creator.catalog_id == entry_id
                        for doc in scan.proposal.documents
                        for creator in doc.creators
                    )
                ]
                replacements = [
                    entry for entry in catalog.directory if entry.id != entry_id
                ]
                replacement = next(
                    (entry for entry in replacements if entry.id == reassign_to), None
                )
                if reassign_to is not None and replacement is None:
                    raise ValueError("Select a different, existing creator")
                if (affected_documents or affected_scans) and replacement is None:
                    return EntryRemoval(
                        status="in_use",
                        documents=len(affected_documents),
                        scans=len(affected_scans),
                    )
                if replacement is not None:
                    removed = next(entry for entry in entries if entry.id == entry_id)
                    replacement.aliases = list(
                        dict.fromkeys(
                            [*replacement.aliases, removed.name, *removed.aliases]
                        )
                    )
                    for document in affected_documents:
                        document.creator_ids = list(
                            dict.fromkeys(
                                replacement.id if id == entry_id else id
                                for id in document.creator_ids
                            )
                        )
                        document.revision += 1
                        document.history.append(
                            Event(stage="edit", message="Creator reassigned")
                        )
                        storage.save_document(document)
                    for scan in affected_scans:
                        if scan.proposal:
                            for doc in scan.proposal.documents:
                                for creator in doc.creators:
                                    if creator.catalog_id == entry_id:
                                        creator.catalog_id = replacement.id
                                        creator.name = replacement.name
                            storage.save_scan(scan)
                catalog.creators = filtered
            elif kind == "owners":
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
                        document.delivery_confirmation = None
                        if document.inbox_id == "shared":
                            document.delivery_status = "review"
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
                removed = next(entry for entry in entries if entry.id == entry_id)
                if any(
                    entry_id in document.creator_ids for document in documents
                ) or any(
                    scan.proposal
                    and any(
                        creator.catalog_id == entry_id
                        for doc in scan.proposal.documents
                        for creator in doc.creators
                    )
                    for scan in scans
                ):
                    catalog.creators.append(removed)
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
