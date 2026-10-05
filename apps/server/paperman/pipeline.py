import asyncio
import logging

from paperman_parser import Inference
from paperman_parser.models import validate_analysis
from paperman_parser.ocr import OCR

from paperman.filing import file_documents
from paperman.models import Document, Event, Scan
from paperman.pdf import extract_pages, prepare_pdf
from paperman.storage import Storage, safe_path

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
            scan.page_count = await asyncio.to_thread(
                prepare_pdf,
                storage.scan_path(scan.id, "original.pdf"),
                searchable,
                ocr,
                storage.settings().ocr_languages,
            )
            scan.phase = "analyze"
            scan.history.append(
                Event(
                    stage="ocr",
                    message=f"Searchable PDF created: {scan.page_count} pages",
                )
            )
            with storage.transaction():
                storage.save_scan(scan)

        if scan.phase == "analyze":
            pages = await asyncio.to_thread(extract_pages, searchable)
            catalog = storage.catalog()
            source = await asyncio.to_thread(searchable.read_bytes)
            proposal = await inference.analyze(source, catalog)
            empty_pages = {
                number for number, text in enumerate(pages, 1) if not text.strip()
            }
            for document in proposal.documents:
                unchecked = sorted(empty_pages.intersection(document.pages))
                if unchecked:
                    warning = (
                        "No readable text on pages "
                        + ", ".join(map(str, unchecked))
                        + ". Content was retained. Check for unreadable text or missed OCR."
                    )
                    document.review_reason = " ".join(
                        filter(None, [document.review_reason, warning])
                    )
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
                or not proposal.documents
                or any(
                    doc.confidence < 0.9 or doc.review_reason.strip()
                    for doc in proposal.documents
                )
            )
            if requires_review:
                scan.status = "review"
                if validation_error:
                    message = validation_error
                elif not proposal.documents:
                    message = "All pages were marked blank. Check the original before completing this scan"
                else:
                    message = "Confirm document groups, blank pages, and filing details"
                scan.history.append(Event(stage="analyze", message=message))
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


async def enrich_document(
    storage: Storage, inference: Inference, document: Document
) -> None:
    try:
        with storage.transaction():
            document = storage.get_document(document.id)
            try:
                scan = storage.get_scan(document.scan_id)
            except FileNotFoundError:
                scan = None
            if scan is not None and scan.status != "complete":
                return
            document.enrichment_status = "running"
            document.enrichment_error = ""
            storage.save_document(document)
        source = await asyncio.to_thread(
            safe_path(storage.root, document.final_path).read_bytes
        )
        catalog = storage.catalog()
        result = await inference.enrich(source, catalog)
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
            generated_tags = sorted(set(result.tag_ids))
            suggested_tags = sorted(set(result.suggested_tags))
            summary = document.summary if document.summary_edited else result.summary
            if (
                document.generated_tags != generated_tags
                or document.suggested_tags != suggested_tags
                or document.summary != summary
            ):
                document.revision += 1
            document.generated_tags = generated_tags
            document.suggested_tags = suggested_tags
            document.summary = summary
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
