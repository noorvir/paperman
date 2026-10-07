import asyncio
from functools import partial
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from paperman_parser.inference import EndpointInference
from paperman_parser.models import Analysis, Identifier, validate_analysis

from paperman.api_models import (
    ScanDetail,
    ScanFeedback,
    ScanPage,
    ScanReprocess,
    ScanReview,
)
from paperman.config import Settings
from paperman.models import Event, Scan, now
from paperman.pdf import validate_scan
from paperman.progress import scan_progress
from paperman.storage import FileStorage, atomic_target, write_record
from paperman.usage import record_scan_usage


def routes(storage: FileStorage, config: Settings) -> APIRouter:
    router = APIRouter()

    @router.get("/api/scans", operation_id="scans")
    def scans(
        status: str = "", q: str = "", page: Annotated[int, Query(ge=1)] = 1
    ) -> ScanPage:
        items = [
            scan
            for scan in storage.list_scans()
            if (not status or scan.status == status)
            and q.casefold() in scan.original_name.casefold()
        ]
        return ScanPage(
            items=items[(page - 1) * 25 : page * 25],
            total=len(items),
            page=page,
            pages=max(1, (len(items) + 24) // 25),
        )

    @router.get("/api/scans/{scan_id}", operation_id="scan")
    def scan(scan_id: Identifier) -> ScanDetail:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            documents = [
                doc for doc in storage.list_documents() if doc.id in scan.document_ids
            ]
        return ScanDetail.model_validate(
            scan.model_dump() | {"pipeline": scan_progress(scan, documents)}
        )

    @router.get("/api/scans/{scan_id}/pdf", operation_id="scan_pdf")
    def scan_pdf(
        scan_id: Identifier, variant: Literal["original", "searchable"] = "original"
    ) -> FileResponse:
        scan = storage.get_scan(scan_id)
        path = storage.scan_path(scan_id, variant + ".pdf")
        if not path.exists():
            raise FileNotFoundError()
        return FileResponse(
            path,
            media_type="application/pdf",
            filename=scan.original_name,
            content_disposition_type="inline",
        )

    @router.post("/api/scans/{scan_id}/retry", operation_id="retry_scan")
    def retry_scan(scan_id: Identifier) -> Scan:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            if scan.status != "failed":
                raise HTTPException(409, "Only failed scans can be retried")
            scan.status = "queued"
            scan.history.append(Event(stage=scan.phase, message="Retry requested"))
            storage.save_scan(scan)
            (storage.root / "state" / "wake").touch()
        return scan

    @router.post("/api/scans/{scan_id}/reprocess", operation_id="reprocess_scan")
    def reprocess_scan(scan_id: Identifier, value: ScanReprocess) -> Scan:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            if scan.status != "complete":
                raise HTTPException(
                    409, "Wait for this scan to finish before starting a new run"
                )
            documents = [storage.get_document(id) for id in scan.document_ids]
            if (
                scan.filing_revision != value.filing_revision
                or value.document_revisions
                != {doc.id: doc.revision for doc in documents}
            ):
                raise HTTPException(
                    409, "These results changed. Reload before confirming a new run"
                )
            if any(doc.enrichment_status == "running" for doc in documents):
                raise HTTPException(
                    409, "Wait for tagging to finish before starting a new run"
                )
            if not storage.scan_path(scan.id, "original.pdf").is_file():
                raise HTTPException(
                    409, "The original PDF is missing. Restore it before reprocessing"
                )

            storage.archive(scan)
            write_record(
                storage.scan_path(
                    scan.id, f"revisions/{scan.filing_revision}/scan.json"
                ),
                scan,
            )
            scan.filing_revision += 1
            scan.processing_run += 1
            scan.filing_paths = {}
            scan.proposal = None
            scan.ocr_rotations = None
            scan.attempts = 0
            scan.phase = "analyze"
            scan.status = "queued"
            scan.history.append(
                Event(
                    stage="reprocess",
                    message=f"Run {scan.processing_run} requested: replace all results from the original PDF",
                )
            )
            storage.save_scan(scan)
            (storage.root / "state" / "wake").touch()
        return scan

    @router.put("/api/scans/{scan_id}/review", operation_id="approve_scan")
    def approve_scan(scan_id: Identifier, value: ScanReview) -> Scan:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            if scan.status not in ("review", "complete"):
                raise HTTPException(
                    409, "Wait for this scan to finish before editing its groups"
                )
            validate_analysis(value, scan.page_count, storage.catalog())
            if scan.status == "complete":
                documents = [storage.get_document(id) for id in scan.document_ids]
                if value.document_revisions != {
                    doc.id: doc.revision for doc in documents
                }:
                    raise HTTPException(
                        409,
                        "These documents changed. Reload the page before editing their groups",
                    )
                if any(doc.enrichment_status == "running" for doc in documents):
                    raise HTTPException(
                        409, "Wait for tagging to finish before editing page groups"
                    )
                write_record(
                    storage.scan_path(
                        scan.id, f"revisions/{scan.filing_revision}/scan.json"
                    ),
                    scan,
                )
                scan.filing_revision += 1
            scan.proposal = Analysis(
                documents=value.documents,
                blank_pages=value.blank_pages,
                page_rotations=value.page_rotations,
            )
            scan.status = "queued"
            scan.phase = "file"
            scan.history.append(
                Event(
                    stage="review",
                    message="Document groups approved"
                    if scan.filing_revision
                    else "Filing details approved",
                )
            )
            storage.save_scan(scan)
            (storage.root / "state" / "wake").touch()
        return scan

    @router.post("/api/scans/{scan_id}/review", operation_id="revise_scan")
    async def revise_scan(scan_id: Identifier, value: ScanFeedback) -> Analysis:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            if scan.status not in ("review", "complete"):
                raise HTTPException(
                    409, "Wait for processing to finish before changing the proposal"
                )
            catalog = storage.catalog()
            settings = storage.settings()
        if settings.provider == "demo":
            raise HTTPException(
                422, "Connect a model in Settings to use review feedback"
            )
        if not value.instructions.strip():
            raise HTTPException(422, "Describe the changes you want")
        validate_analysis(value.proposal, scan.page_count, catalog)
        source = await asyncio.to_thread(
            storage.scan_path(scan.id, "original.pdf").read_bytes
        )
        inference = EndpointInference(
            settings,
            config.model_api_key,
            record_usage=partial(
                record_scan_usage, storage, scan_id, processing_run=scan.processing_run
            ),
        )
        result = await inference.revise(
            source, catalog, value.proposal, value.instructions
        )
        with storage.transaction():
            current = storage.get_scan(scan_id)
            if (current.status, current.attempts, current.filing_revision) != (
                scan.status,
                scan.attempts,
                scan.filing_revision,
            ):
                raise HTTPException(
                    409, "This scan changed. Reload before updating the proposal"
                )
            validate_analysis(result, current.page_count, storage.catalog())
        return result

    @router.post("/api/uploads", operation_id="upload")
    def upload(file: UploadFile) -> Scan:
        if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
            raise HTTPException(422, "Select a PDF file")
        filename = f"{now().strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:12]}-{Path(file.filename).name}"
        target = storage.root / "inbox" / filename
        size = 0
        with storage.transaction():
            with atomic_target(target) as temporary:
                with temporary.open("wb") as output:
                    while chunk := file.file.read(1024 * 1024):
                        size += len(chunk)
                        if size > config.max_upload_mb * 1024 * 1024:
                            raise HTTPException(413, "PDF exceeds the upload limit")
                        output.write(chunk)
                with temporary.open("rb") as source:
                    if source.read(5) != b"%PDF-":
                        raise HTTPException(422, "This file is not a PDF")
                validate_scan(temporary)
            scan = storage.ingest(target)
            if scan.original_name == filename:
                scan.timestamp_source = "upload"
                storage.save_scan(scan)
        (storage.root / "state" / "wake").touch()
        return scan

    return router
