from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from paperman_parser.models import Identifier

from paperman.api_models import ActionResult, DocumentCreate
from paperman.auth import Auth, Principal, check_document, check_source
from paperman.catalog import visible_catalog
from paperman.document_names import document_filename
from paperman.models import Document, Event, now
from paperman.pdf import split_pdf
from paperman.storage import FileStorage, atomic_target, safe_path, write_record


def routes(storage: FileStorage, auth: Auth) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/api/scans/{scan_id}/documents",
        operation_id="create_document",
        status_code=201,
    )
    def create_document(
        scan_id: Identifier,
        value: DocumentCreate,
        principal: Annotated[Principal | None, Depends(auth)],
    ) -> Document:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            check_source(principal, scan)
            if (
                scan.status != "complete"
                or scan.filing_revision != value.filing_revision
            ):
                raise HTTPException(
                    409, "This scan changed. Reopen the form to continue"
                )
            if (
                len(set(value.source_pages)) != len(value.source_pages)
                or max(value.source_pages) > scan.page_count
            ):
                raise ValueError("Select each page once, within the source scan")
            catalog = visible_catalog(storage, principal)
            allowed_owners = {entry.id for entry in catalog.owners} | {"unknown"}
            if principal is not None and not principal.admin:
                allowed_owners = set(principal.owner_ids) | {"unknown"}
            if not set(value.owner_ids) <= allowed_owners:
                raise HTTPException(403, "Select owners available to your account")
            if not set(value.creator_ids) <= {entry.id for entry in catalog.directory}:
                raise ValueError("Select creators from the directory")
            if not set(value.tag_ids) <= {entry.id for entry in catalog.tags}:
                raise ValueError("Select tags from the catalog")

            identifier = f"manual-{uuid4().hex}"
            date = value.document_date or scan.scanned_at.date()
            timestamp = int(now().timestamp() * 1000)
            while True:
                filename = document_filename(date, value.title, timestamp)
                if not any(
                    safe_path(storage.root, f"documents/{owner}/{filename}")
                    .with_suffix(suffix)
                    .exists()
                    for owner in value.owner_ids
                    for suffix in (".pdf", ".txt", ".toml")
                ):
                    break
                timestamp += 1
            doc = Document(
                id=identifier,
                scan_id=scan.id,
                inbox_id=scan.inbox_id,
                processing_run=scan.processing_run,
                source_pages=value.source_pages,
                page_rotations=[
                    r
                    for r in (scan.ocr_rotations or [])
                    if r.page in value.source_pages
                ],
                owner_ids=value.owner_ids,
                creator_ids=value.creator_ids,
                creators_edited=bool(value.creator_ids),
                title=value.title,
                document_date=date,
                date_source="document" if value.document_date else "scan_fallback",
                scanned_at=scan.scanned_at,
                final_path=f"documents/{value.owner_ids[0]}/{filename}",
                user_tags=value.tag_ids,
                history=[
                    Event(stage="create", message="Created from selected scan pages")
                ],
            )
            inbox = storage.get_inbox(scan.inbox_id)
            if inbox.account_id is not None:
                doc.access_user_ids = [inbox.account_id]
                doc.delivery_status = "delivered"
            target = safe_path(storage.root, doc.final_path)
            text = split_pdf(
                storage.scan_path(scan.id, "searchable.pdf"), target, value.source_pages
            )
            with atomic_target(target.with_suffix(".txt")) as temporary:
                temporary.write_text(text)
            # Publish through the scan's document list, as in the filing workflow.
            storage.archive(scan)
            write_record(
                storage.scan_path(
                    scan.id, f"revisions/{scan.filing_revision}/scan.json"
                ),
                scan,
            )
            scan.filing_revision += 1
            storage.save_scan(scan)
            storage.save_document(doc)
            scan.document_ids.append(doc.id)
            scan.history.append(
                Event(stage="create", message=f"Created document: {doc.title}")
            )
            storage.save_scan(scan)
            storage.rebuild_index()
            (storage.root / "state" / "wake").touch()
            return doc

    @router.delete("/api/documents/{document_id}", operation_id="delete_document")
    def delete_document(
        document_id: Identifier,
        revision: Annotated[int, Query(ge=0)],
        principal: Annotated[Principal | None, Depends(auth)],
    ) -> ActionResult:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            if principal is not None and not principal.can_manage_document(doc):
                raise HTTPException(403, "You cannot delete documents from this inbox")
            scan = storage.get_scan(doc.scan_id)
            if doc.revision != revision:
                raise HTTPException(
                    409, "This document changed. Reopen it before deleting"
                )
            if scan.status != "complete" or doc.enrichment_status == "running":
                raise HTTPException(
                    409, "Wait for processing to finish before deleting"
                )
            storage.archive(scan)
            write_record(
                storage.scan_path(
                    scan.id, f"revisions/{scan.filing_revision}/scan.json"
                ),
                scan,
            )
            scan.filing_revision += 1
            scan.document_ids = [id for id in scan.document_ids if id != doc.id]
            scan.history.append(
                Event(stage="delete", message=f"Deleted document: {doc.title}")
            )
            storage.save_scan(scan)
            storage.archive(scan)
            storage.rebuild_index()
            return ActionResult(
                message="Document deleted. The original scan and history are kept"
            )

    return router
