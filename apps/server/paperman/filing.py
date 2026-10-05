from datetime import UTC
from pathlib import Path

from paperman_parser.models import validate_analysis

from paperman.models import Document, Event, Scan
from paperman.pdf import split_pdf
from paperman.storage import Storage, atomic_target, safe_path, slug


def file_documents(storage: Storage, scan: Scan) -> Scan:
    proposal = scan.proposal
    if proposal is None:
        raise ValueError("A filing proposal is required")
    validate_analysis(proposal, scan.page_count, storage.catalog())
    current = [storage.get_document(id) for id in scan.document_ids]
    by_pages = {tuple(doc.source_pages): doc for doc in current}
    document_ids: list[str] = []
    for number, item in enumerate(proposal.documents, 1):
        document_date = item.document_date or scan.scanned_at.date()
        date_source = "document" if item.document_date else "scan_fallback"
        retained = by_pages.get(tuple(item.pages))
        if retained is not None:
            with storage.transaction():
                document = storage.get_document(retained.id)
                if (
                    document.title != item.title
                    or document.owner_id != item.owner_id
                    or document.document_date != document_date
                    or document.date_source != date_source
                ):
                    document.title = item.title
                    document.owner_id = item.owner_id
                    document.document_date = document_date
                    document.date_source = date_source
                    document.revision += 1
                    document.history.append(
                        Event(stage="review", message="Filing details corrected")
                    )
                    storage.save_document(document)
            document_ids.append(document.id)
            continue

        identifier = f"{scan.id}-{number}"
        if scan.filing_revision:
            identifier = f"{scan.id}-r{scan.filing_revision}-{number}"
        timestamp = scan.scanned_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
        filename = f"{document_date}__scanned-{timestamp}__{slug(item.title)}__{identifier}.pdf"
        final_path = f"documents/{item.owner_id}/{filename}"
        document = Document(
            id=identifier,
            scan_id=scan.id,
            source_pages=item.pages,
            owner_id=item.owner_id,
            title=item.title,
            document_date=document_date,
            date_source=date_source,
            scanned_at=scan.scanned_at,
            final_path=final_path,
        )
        if scan.filing_revision:
            replaced = [
                doc.id for doc in current if set(doc.source_pages) & set(item.pages)
            ]
            document.history.append(
                Event(stage="regroup", message="Replaces " + ", ".join(replaced))
            )
        with storage.transaction():
            try:
                existing = storage.get_document(identifier, include_unpublished=True)
            except FileNotFoundError:
                existing = None
            if existing is not None:
                if (
                    Path(existing.final_path).name != filename
                    or existing.owner_id != item.owner_id
                    or existing.source_pages != item.pages
                ):
                    raise ValueError(
                        "Filing details changed after publication. Restore the approved proposal"
                    )
                final_path = existing.final_path
            target = safe_path(storage.root, final_path)
            if (
                not existing
                or not target.exists()
                or not target.with_suffix(".txt").exists()
            ):
                text = split_pdf(
                    storage.scan_path(scan.id, "searchable.pdf"), target, item.pages
                )
                with atomic_target(target.with_suffix(".txt")) as temporary:
                    temporary.write_text(text)
                storage.save_document(existing or document)
        document_ids.append(identifier)

    # This checkpoint publishes the complete set; a failed revision keeps the old set visible.
    completed = scan.model_copy(deep=True)
    completed.document_ids = document_ids
    completed.phase = "done"
    completed.status = "complete"
    completed.history.append(
        Event(stage="file", message=f"Filed {len(document_ids)} documents")
    )
    if proposal.blank_pages:
        completed.history.append(
            Event(
                stage="file",
                message="Omitted blank source pages: "
                + ", ".join(map(str, proposal.blank_pages))
                + ". All pages remain in the original scan",
            )
        )
    with storage.transaction():
        storage.save_scan(completed)
    return completed
