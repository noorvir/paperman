from datetime import date
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from paperman_parser.models import Identifier, PageRotation
from paperman_parser.pdf import rotate_pages

from paperman.api_models import (
    AccountInbox,
    DeliveryConfirmation,
    DocumentAccess,
    DocumentDelivery,
    DocumentDetail,
    DocumentEdit,
    DocumentPage,
    DocumentVerify,
    SourceReference,
    TagSelection,
)
from paperman.auth import Auth, Principal, check_document
from paperman.models import Document, Event, SearchIndex, Verification, now
from paperman.pdf import edit_pages
from paperman.storage import FileStorage, atomic_target, safe_path


def routes(storage: FileStorage, auth: Auth) -> APIRouter:
    router = APIRouter()

    @router.get("/api/documents", operation_id="documents")
    def documents(
        principal: Annotated[Principal | None, Depends(auth)],
        q: str = "",
        owner: Annotated[list[str] | None, Query()] = None,
        tag: Annotated[list[str] | None, Query()] = None,
        status: str = "",
        delivery: Literal["", "review", "delivered"] = "",
        inbox: str = "",
        after: date | None = None,
        before: date | None = None,
        sort: Literal[
            "date_desc",
            "date_asc",
            "title",
            "title_desc",
            "owners_asc",
            "owners_desc",
            "tags_asc",
            "tags_desc",
            "verification_asc",
            "verification_desc",
            "delivery_asc",
            "delivery_desc",
            "processed_asc",
            "processed_desc",
        ] = "date_desc",
        page: Annotated[int, Query(ge=1)] = 1,
    ) -> DocumentPage:
        if after and before and after > before:
            raise HTTPException(422, "The start date must be on or before the end date")
        owners = set(owner or ()) - {""}
        tags = set(tag or ()) - {""}
        documents = storage.list_documents()
        index_path = storage.root / "state" / "search.json"
        index = (
            SearchIndex.model_validate_json(index_path.read_bytes())
            if index_path.exists()
            else storage.rebuild_index()
        )
        text = {entry.document_id: entry.text.casefold() for entry in index.entries}
        terms = q.casefold().split()
        items = [
            doc
            for doc in documents
            if (principal is None or principal.can_view(doc))
            and (not owners or set(doc.owner_ids).intersection(owners))
            and (not tags or not tags.isdisjoint(effective_tags(doc)))
            and (not status or doc.enrichment_status == status)
            and (not delivery or doc.delivery_status == delivery)
            and (not inbox or doc.inbox_id == inbox)
            and (not after or doc.document_date >= after)
            and (not before or doc.document_date <= before)
            and all(
                term
                in f"{doc.title} {doc.summary}".casefold()
                + (
                    doc.text_override.casefold()
                    if doc.text_override is not None
                    else text.get(doc.id, "")
                )
                for term in terms
            )
        ]
        descending = sort.endswith("_desc")
        items.sort(key=lambda doc: doc.id)
        if sort in ("title", "title_desc"):
            items.sort(key=lambda doc: doc.title.casefold(), reverse=descending)
        elif sort.startswith("owners_"):
            names = {
                entry.id: entry.name.casefold() for entry in storage.catalog().owners
            }
            items.sort(
                key=lambda doc: tuple(
                    sorted(names.get(id, id) for id in doc.owner_ids)
                ),
                reverse=descending,
            )
        elif sort.startswith("tags_"):
            names = {
                entry.id: entry.name.casefold() for entry in storage.catalog().tags
            }
            items.sort(
                key=lambda doc: tuple(
                    sorted(names.get(id, id) for id in effective_tags(doc))
                ),
                reverse=descending,
            )
        elif sort.startswith("verification_"):
            items.sort(key=lambda doc: doc.verification is not None, reverse=descending)
        elif sort.startswith("delivery_"):
            items.sort(
                key=lambda doc: doc.delivery_status == "delivered", reverse=descending
            )
        elif sort.startswith("processed_"):
            items.sort(
                key=lambda doc: (
                    doc.processed_at.timestamp() if doc.processed_at else float("-inf")
                ),
                reverse=descending,
            )
        else:
            items.sort(key=lambda doc: (doc.document_date, doc.id), reverse=descending)
        return DocumentPage(
            items=items[(page - 1) * 25 : page * 25],
            total=len(items),
            page=page,
            pages=max(1, (len(items) + 24) // 25),
        )

    @router.get("/api/documents/{document_id}", operation_id="document")
    def document(
        document_id: Identifier, principal: Annotated[Principal | None, Depends(auth)]
    ) -> DocumentDetail:
        doc = storage.get_document(document_id)
        check_document(principal, doc)
        return document_detail(storage, principal, doc)

    @router.put("/api/documents/{document_id}", operation_id="edit_document")
    def edit_document(
        document_id: Identifier,
        value: DocumentEdit,
        principal: Annotated[Principal | None, Depends(auth)],
    ) -> DocumentDetail:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            ensure_filed(storage, doc)
            if doc.revision != value.revision:
                raise HTTPException(
                    409,
                    "This document changed. Cancel and reopen the editor to load the latest version",
                )
            if principal is not None and (
                not principal.admin or not principal.can_manage_document(doc)
            ):
                if (
                    value.owner_ids != doc.owner_ids
                    or value.rotations
                    or value.source_pages not in (None, doc.source_pages)
                ):
                    raise HTTPException(
                        403,
                        "Organization admin access is required to change owners or pages",
                    )
            if value.rotations or value.source_pages not in (None, doc.source_pages):
                if principal is not None and not principal.can_view_source(
                    storage.get_scan(doc.scan_id)
                ):
                    raise HTTPException(
                        403, "Source access is required to change pages"
                    )
            catalog = storage.catalog()
            if not set(value.owner_ids) <= {owner.id for owner in catalog.owners}:
                raise ValueError("Select owners from the catalog")
            allowed_tags = {tag.id for tag in catalog.tags}
            if not set(value.tag_ids) <= allowed_tags:
                raise ValueError("Select tags from the catalog")

            pages = (
                value.source_pages
                if value.source_pages is not None
                else doc.source_pages
            )
            if len(pages) != len(set(pages)):
                raise ValueError("Select each source page once")
            pages_changed = pages != doc.source_pages
            if pages_changed and doc.enrichment_status == "running":
                raise HTTPException(
                    409, "Wait for document processing to finish before changing pages"
                )
            path = safe_path(storage.root, doc.final_path)
            changed_pdf = None
            selected_text = None
            if pages_changed:
                scan = storage.get_scan(doc.scan_id)
                doc.page_rotations = [
                    rotation
                    for rotation in (scan.ocr_rotations or [])
                    if rotation.page in pages
                ]
                changed_pdf, selected_text = edit_pages(
                    storage.scan_path(doc.scan_id, "searchable.pdf"),
                    path,
                    doc.source_pages,
                    pages,
                )
            if value.rotations:
                changed_pdf = rotate_pages(
                    changed_pdf if changed_pdf is not None else path.read_bytes(),
                    value.rotations,
                )

            updates = {
                "source pages": pages_changed,
                "page rotation": bool(value.rotations),
                "title": value.title != doc.title,
                "owners": value.owner_ids != doc.owner_ids,
                "date": (value.document_date or doc.scanned_at.date())
                != doc.document_date
                or (value.document_date is None)
                != (doc.date_source == "scan_fallback"),
                "summary": value.summary != doc.summary,
                "tags": set(value.tag_ids) != effective_tags(doc),
                "text": value.text != storage.document_text(doc),
            }
            changed = [name for name, different in updates.items() if different]
            if not changed:
                return document_detail(storage, principal, doc)
            if doc.owner_ids != value.owner_ids or pages_changed:
                doc.delivery_confirmation = None
                if doc.inbox_id == "shared":
                    doc.delivery_status = "review"
            doc.title = value.title
            doc.owner_ids = value.owner_ids
            doc.document_date = value.document_date or doc.scanned_at.date()
            doc.date_source = "document" if value.document_date else "scan_fallback"
            if updates["summary"]:
                doc.summary = value.summary
                doc.summary_edited = True
            if updates["tags"]:
                doc.user_tags = sorted(set(value.tag_ids))
                doc.excluded_tags = sorted(allowed_tags - set(value.tag_ids))
            if updates["text"]:
                doc.text_override = value.text
            elif pages_changed:
                doc.text_override = None
            if changed_pdf is not None:
                saved_rotations = {
                    doc.source_pages[item.page - 1]: item.clockwise
                    for item in doc.manual_rotations
                }
                corrections = {
                    index: saved_rotations[page]
                    for index, page in enumerate(pages, 1)
                    if page in saved_rotations
                }
                for item in value.rotations:
                    corrections[item.page] = (
                        corrections.get(item.page, 0) + item.clockwise
                    ) % 360
                doc.manual_rotations = [
                    PageRotation.model_validate({"page": page, "clockwise": clockwise})
                    for page, clockwise in sorted(corrections.items())
                    if clockwise
                ]
                with atomic_target(path) as temporary:
                    temporary.write_bytes(changed_pdf)
                doc.pdf_revision += 1
            if pages_changed:
                doc.source_pages = pages
            if selected_text is not None:
                with atomic_target(path.with_suffix(".txt")) as temporary:
                    temporary.write_text(selected_text)
            doc.revision += 1
            doc.history.append(
                Event(stage="edit", message="Corrected " + ", ".join(changed))
            )
            storage.save_document(doc)
            if pages_changed:
                storage.rebuild_index()
            return document_detail(storage, principal, doc)

    @router.post(
        "/api/documents/{document_id}/confirm-delivery",
        operation_id="confirm_delivery",
    )
    def confirm_delivery(
        document_id: Identifier,
        value: DeliveryConfirmation,
        principal: Annotated[Principal | None, Depends(auth.require_admin)],
    ) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            ensure_filed(storage, doc)
            if doc.inbox_id != "shared":
                raise HTTPException(
                    409, "Personal documents do not need delivery confirmation"
                )
            if doc.revision != value.revision:
                raise HTTPException(
                    409, "This document changed. Reload before confirming delivery"
                )
            owners = {owner.id for owner in storage.catalog().owners} - {"unknown"}
            if not set(doc.owner_ids) <= owners:
                raise HTTPException(
                    422, "Select known owners before confirming delivery"
                )
            if doc.delivery_confirmation is not None:
                return doc
            doc.delivery_confirmation = Verification(
                at=now(), by=principal.name if principal else "Admin"
            )
            doc.delivery_status = "delivered"
            doc.revision += 1
            doc.history.append(
                Event(
                    at=doc.delivery_confirmation.at,
                    stage="delivery",
                    message=f"Owners confirmed by {doc.delivery_confirmation.by}",
                )
            )
            storage.save_document(doc)
            return doc

    @router.post("/api/documents/{document_id}/verify", operation_id="verify_document")
    def verify_document(
        document_id: Identifier,
        value: DocumentVerify,
        principal: Annotated[Principal | None, Depends(auth)],
    ) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            ensure_filed(storage, doc)
            if doc.verification is not None:
                return doc
            if doc.revision != value.revision:
                raise HTTPException(
                    409, "This document changed. Reload it before verifying"
                )
            reviewer = principal.name if principal else value.reviewer
            doc.verification = Verification(at=now(), by=reviewer)
            doc.revision += 1
            doc.history.append(
                Event(
                    at=doc.verification.at,
                    stage="verify",
                    message=f"Verified by {reviewer}",
                )
            )
            storage.save_document(doc)
            return doc

    @router.get("/api/documents/{document_id}/pdf", operation_id="document_pdf")
    def document_pdf(
        document_id: Identifier, principal: Annotated[Principal | None, Depends(auth)]
    ) -> FileResponse:
        doc = storage.get_document(document_id)
        check_document(principal, doc)
        return FileResponse(
            safe_path(storage.root, doc.final_path),
            media_type="application/pdf",
            filename=Path(doc.final_path).name,
            content_disposition_type="inline",
        )

    @router.put("/api/documents/{document_id}/tags", operation_id="document_tags")
    def document_tags(
        document_id: Identifier,
        value: TagSelection,
        principal: Annotated[Principal | None, Depends(auth)],
    ) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            ensure_filed(storage, doc)
            allowed = {tag.id for tag in storage.catalog().tags}
            if not set(value.tag_ids) <= allowed:
                raise ValueError("Select tags from the catalog")
            doc.user_tags = sorted(set(value.tag_ids))
            doc.excluded_tags = sorted(allowed - set(value.tag_ids))
            doc.revision += 1
            doc.history.append(Event(stage="edit", message="Corrected tags"))
            storage.save_document(doc)
            return doc

    @router.post(
        "/api/documents/{document_id}/enrich",
        operation_id="enrich_document",
    )
    def enrich(
        document_id: Identifier, principal: Annotated[Principal | None, Depends(auth)]
    ) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            ensure_filed(storage, doc)
            if doc.enrichment_status in ("pending", "running"):
                raise HTTPException(
                    409, "Document processing is already queued or running"
                )
            doc.enrichment_status = "pending"
            doc.enrichment_error = ""
            doc.history.append(
                Event(
                    stage="tag",
                    message="Document reprocessing requested: tags and summary",
                )
            )
            storage.save_document(doc)
            (storage.root / "state" / "wake").touch()
            return doc

    @router.get("/api/documents/{document_id}/access", operation_id="document_access")
    def document_access(
        document_id: Identifier, principal: Annotated[Principal | None, Depends(auth)]
    ) -> DocumentAccess:
        doc = storage.get_document(document_id)
        check_document(principal, doc)
        if principal is not None and not principal.can_manage_document(doc):
            raise HTTPException(
                403, "Only the source owner or shared-inbox admin can change access"
            )
        recipients = [
            item for item in storage.list_inboxes() if item.account_id is not None
        ]
        return DocumentAccess(
            user_ids=doc.access_user_ids,
            owner_user_id=storage.get_inbox(doc.inbox_id).account_id,
            suggested_user_ids=[
                item.account_id
                for item in recipients
                if item.account_id is not None
                and set(item.routing_owner_ids).intersection(doc.owner_ids)
            ]
            if doc.inbox_id == "shared"
            else [],
            recipients=[
                AccountInbox(account_id=item.account_id, name=item.name)
                for item in recipients
                if item.account_id is not None
            ],
            revision=doc.revision,
        )

    @router.put("/api/documents/{document_id}/access", operation_id="deliver_document")
    def deliver_document(
        document_id: Identifier,
        value: DocumentDelivery,
        principal: Annotated[Principal | None, Depends(auth)],
    ) -> Document:
        with storage.transaction():
            doc = storage.get_document(document_id)
            check_document(principal, doc)
            if principal is not None and not principal.can_manage_document(doc):
                raise HTTPException(
                    403, "Only the source owner or shared-inbox admin can change access"
                )
            ensure_filed(storage, doc)
            if doc.revision != value.revision:
                raise HTTPException(
                    409, "This document changed. Reload before changing access"
                )
            accounts = {
                item.account_id
                for item in storage.list_inboxes()
                if item.account_id is not None
            }
            if not set(value.user_ids) <= accounts:
                raise HTTPException(422, "Select existing accounts")
            users = set(value.user_ids)
            owner = storage.get_inbox(doc.inbox_id).account_id
            if owner is not None:
                users.add(owner)
            doc.access_user_ids = sorted(users)
            if doc.inbox_id != "shared":
                doc.delivery_status = "delivered"
            doc.revision += 1
            doc.history.append(
                Event(stage="delivery", message="Document access updated")
            )
            storage.save_document(doc)
        return doc

    return router


def ensure_filed(storage: FileStorage, document: Document) -> None:
    try:
        scan = storage.get_scan(document.scan_id)
    except FileNotFoundError:
        return
    if scan.status != "complete":
        raise HTTPException(
            409, "This scan is being filed. Finish or retry it before editing documents"
        )


def effective_tags(document: Document) -> set[str]:
    return (set(document.generated_tags) - set(document.excluded_tags)) | set(
        document.user_tags
    )


def document_detail(
    storage: FileStorage, principal: Principal | None, doc: Document
) -> DocumentDetail:
    try:
        scan = storage.get_scan(doc.scan_id)
        accessible = principal is None or principal.can_view_source(scan)
    except FileNotFoundError:
        accessible = False
    return DocumentDetail(
        document=doc,
        text=storage.document_text(doc),
        source=SourceReference(
            scan_id=doc.scan_id,
            inbox="shared" if doc.inbox_id == "shared" else "personal",
            accessible=accessible,
        ),
        can_manage_access=principal is None or principal.can_manage_document(doc),
        can_edit_pages=accessible and (principal is None or principal.admin),
    )
