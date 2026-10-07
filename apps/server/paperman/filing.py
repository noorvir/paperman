from paperman_parser.models import validate_analysis
from paperman_parser.pdf import rotate_pages
from paperman_parser.usage import allocate_usage

from paperman.document_names import document_filename
from paperman.models import Document, Event, Scan
from paperman.pdf import split_pdf
from paperman.storage import Storage, atomic_target, safe_path


def file_documents(storage: Storage, scan: Scan) -> Scan:
    proposal = scan.proposal
    if proposal is None:
        raise ValueError("A filing proposal is required")
    validate_analysis(proposal, scan.page_count, storage.catalog())
    current = [storage.get_document(id) for id in scan.document_ids]
    by_pages = {
        tuple(doc.source_pages): doc
        for doc in current
        if doc.processing_run == scan.processing_run
    }
    calls = [
        call for call in scan.processing if call.processing_run == scan.processing_run
    ]
    document_ids: list[str] = []
    retained_pages = [page for item in proposal.documents for page in item.pages]
    source = storage.scan_path(scan.id, "searchable.pdf")
    for number, item in enumerate(proposal.documents, 1):
        rotations = [
            rotation
            for rotation in proposal.page_rotations
            if rotation.page in item.pages
        ]
        document_date = item.document_date or scan.scanned_at.date()
        date_source = "document" if item.document_date else "scan_fallback"
        retained = by_pages.get(tuple(item.pages))
        if retained is not None:
            with storage.transaction():
                document = storage.get_document(retained.id)
                if (
                    document.title != item.title
                    or document.owner_ids != item.owner_ids
                    or document.page_rotations != rotations
                    or document.document_date != document_date
                    or document.date_source != date_source
                ):
                    document.title = item.title
                    document.owner_ids = item.owner_ids
                    document.document_date = document_date
                    document.date_source = date_source
                    document.revision += 1
                    document.history.append(
                        Event(stage="review", message="Filing details corrected")
                    )
                if document.page_rotations != rotations:
                    target = safe_path(storage.root, document.final_path)
                    text = split_pdf(source, target, item.pages)
                    with atomic_target(target.with_suffix(".txt")) as temporary:
                        temporary.write_text(text)
                    if document.manual_rotations:
                        corrected = rotate_pages(
                            target.read_bytes(), document.manual_rotations
                        )
                        with atomic_target(target) as temporary:
                            temporary.write_bytes(corrected)
                    document.page_rotations = rotations
                document.processing = allocate_usage(calls, item.pages, retained_pages)
                storage.save_document(document)
            document_ids.append(document.id)
            continue

        identifier = f"{scan.id}-{number}"
        if scan.filing_revision:
            identifier = f"{scan.id}-r{scan.filing_revision}-{number}"
        with storage.transaction():
            try:
                existing = storage.get_document(identifier, include_unpublished=True)
            except FileNotFoundError:
                existing = None
            if existing is not None:
                if (
                    existing.title != item.title
                    or existing.document_date != document_date
                    or existing.owner_ids != item.owner_ids
                    or existing.source_pages != item.pages
                ):
                    raise ValueError(
                        "Filing details changed after publication. Restore the approved proposal"
                    )
                final_path = existing.final_path
            else:
                final_path = scan.filing_paths.get(identifier)
                if final_path is None:
                    timestamp = int(scan.scanned_at.timestamp() * 1000)
                    reserved = {
                        path
                        for saved in storage.list_scans()
                        for path in saved.filing_paths.values()
                    }
                    while True:
                        filename = document_filename(
                            document_date, item.title, timestamp
                        )
                        paths = [
                            f"documents/{owner}/{filename}" for owner in item.owner_ids
                        ]
                        final_path = paths[0]
                        if not set(paths).intersection(reserved) and not any(
                            safe_path(storage.root, path).with_suffix(suffix).exists()
                            for path in paths
                            for suffix in (".pdf", ".txt", ".toml")
                        ):
                            break
                        timestamp += 1
                    scan.filing_paths[identifier] = final_path
                    storage.save_scan(scan)
            document = existing or Document(
                id=identifier,
                scan_id=scan.id,
                processing_run=scan.processing_run,
                source_pages=item.pages,
                owner_ids=item.owner_ids,
                page_rotations=rotations,
                title=item.title,
                document_date=document_date,
                date_source=date_source,
                scanned_at=scan.scanned_at,
                final_path=final_path,
            )
            if existing is None:
                previous = next(
                    (doc for doc in current if doc.source_pages == item.pages), None
                )
                if previous is not None:
                    document.verification = previous.verification
            document.processing = allocate_usage(calls, item.pages, retained_pages)
            if existing is None and scan.filing_revision:
                replaced = [
                    doc.id for doc in current if set(doc.source_pages) & set(item.pages)
                ]
                document.history.append(
                    Event(stage="regroup", message="Replaces " + ", ".join(replaced))
                )
            target = safe_path(storage.root, final_path)
            if (
                not existing
                or not target.exists()
                or not target.with_suffix(".txt").exists()
            ):
                text = split_pdf(source, target, item.pages)
                with atomic_target(target.with_suffix(".txt")) as temporary:
                    temporary.write_text(text)
            storage.save_document(document)
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
