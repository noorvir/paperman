import asyncio
import logging
from datetime import UTC
from pathlib import Path

from paperman.inference import Inference
from paperman.models import Document, Event, Scan, validate_analysis
from paperman.pdf import OCR, extract_pages, split_pdf
from paperman.storage import Storage, atomic_target, safe_path, slug

logger = logging.getLogger(__name__)


async def process_scan(
    storage: Storage, inference: Inference, ocr: OCR, scan: Scan
) -> None:
    try:
        with storage.transaction():
            scan = storage.get_scan(scan.id)
            scan.status = "running"
            scan.attempts += 1
            storage.save_scan(scan)
        searchable = storage.scan_path(scan.id, "searchable.pdf")
        if scan.phase == "ocr":
            pages = await asyncio.to_thread(
                ocr.searchable,
                storage.scan_path(scan.id, "original.pdf"),
                searchable,
                storage.settings().ocr_languages,
            )
            scan.page_count = len(pages)
            scan.phase = "analyze"
            scan.history.append(
                Event(
                    stage="ocr", message=f"Searchable PDF created: {len(pages)} pages"
                )
            )
            with storage.transaction():
                storage.save_scan(scan)

        if scan.phase == "analyze":
            pages = await asyncio.to_thread(extract_pages, searchable)
            catalog = storage.catalog()
            proposal = await inference.analyze(pages, catalog)
            scan.proposal = proposal
            validation_error = ""
            try:
                validate_analysis(proposal, scan.page_count, catalog)
            except ValueError as error:
                validation_error = str(error)
            scan.phase = "file"
            requires_review = (
                storage.settings().review_before_filing
                or bool(validation_error)
                or any(
                    doc.confidence < 0.9
                    or doc.review_reason
                    or doc.owner_id == "unknown"
                    for doc in proposal.documents
                )
            )
            if requires_review:
                scan.status = "review"
                scan.history.append(
                    Event(
                        stage="analyze",
                        message=validation_error
                        or "Confirm document groups and filing details",
                    )
                )
                with storage.transaction():
                    storage.save_scan(scan)
                return
            with storage.transaction():
                storage.save_scan(scan)

        if scan.phase == "file":
            await asyncio.to_thread(file_documents, storage, scan)
    except Exception as error:
        logger.exception("Scan %s failed during %s", scan.id, scan.phase)
        scan.status = "failed"
        message = (
            str(error)
            if isinstance(error, ValueError)
            else f"{scan.phase.capitalize()} failed. Check the worker log and retry"
        )
        scan.history.append(Event(stage=scan.phase, message=message))
        with storage.transaction():
            storage.save_scan(scan)


def file_documents(storage: Storage, scan: Scan) -> None:
    proposal = scan.proposal
    if proposal is None:
        raise ValueError("A filing proposal is required")
    validate_analysis(proposal, scan.page_count, storage.catalog())
    for number, item in enumerate(proposal.documents, 1):
        identifier = f"{scan.id}-{number}"
        document_date = item.document_date or scan.scanned_at.date()
        timestamp = scan.scanned_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
        filename = f"{document_date}__scanned-{timestamp}__{slug(item.title)}__{identifier}.pdf"
        final_path = f"documents/{item.owner_id}/{filename}"
        document = Document(
            id=identifier,
            scan_id=scan.id,
            source_pages=item.pages,
            owner_id=item.owner_id,
            title=item.title.strip(),
            document_date=document_date,
            date_source="document" if item.document_date else "scan_fallback",
            scanned_at=scan.scanned_at,
            final_path=final_path,
        )
        with storage.transaction():
            try:
                existing = storage.get_document(identifier)
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
                if safe_path(storage.root, final_path).exists():
                    continue
            target = safe_path(storage.root, final_path)
            text = split_pdf(
                storage.scan_path(scan.id, "searchable.pdf"), target, item.pages
            )
            with atomic_target(target.with_suffix(".txt")) as temporary:
                temporary.write_text(text)
            storage.save_document(existing or document)
    scan.document_ids = [
        f"{scan.id}-{number}" for number in range(1, len(proposal.documents) + 1)
    ]
    scan.phase = "done"
    scan.status = "complete"
    scan.history.append(
        Event(stage="file", message=f"Filed {len(scan.document_ids)} documents")
    )
    with storage.transaction():
        storage.save_scan(scan)


async def enrich_document(
    storage: Storage, inference: Inference, document: Document
) -> None:
    try:
        with storage.transaction():
            document = storage.get_document(document.id)
            document.enrichment_status = "running"
            document.enrichment_error = ""
            storage.save_document(document)
        text = (
            safe_path(storage.root, document.final_path).with_suffix(".txt").read_text()
        )
        catalog = storage.catalog()
        result = await inference.enrich(text, catalog)
        tag_ids = {tag.id for tag in catalog.tags}
        if not set(result.tag_ids) <= tag_ids:
            raise ValueError("The model returned a tag outside the catalog")
        with storage.transaction():
            current_tag_ids = {tag.id for tag in storage.catalog().tags}
            if not set(result.tag_ids) <= current_tag_ids:
                raise ValueError(
                    "The tag catalog changed during processing. Retry tagging"
                )
            document = storage.get_document(document.id)
            document.generated_tags = sorted(set(result.tag_ids))
            document.suggested_tags = sorted(set(result.suggested_tags))
            document.summary = result.summary
            document.enrichment_version = inference.version
            document.enrichment_status = "complete"
            storage.save_document(document)
    except Exception as error:
        logger.exception("Enrichment failed for %s", document.id)
        with storage.transaction():
            document = storage.get_document(document.id)
            document.enrichment_status = "failed"
            document.enrichment_error = (
                str(error)
                if isinstance(error, ValueError)
                else "Tagging failed. Check the model endpoint and retry"
            )
            storage.save_document(document)
