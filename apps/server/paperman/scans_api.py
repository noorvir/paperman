from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from paperman_parser.models import Analysis, Identifier, validate_analysis

from paperman.api_models import ActionResult, ScanPage, ScanReview
from paperman.config import Settings
from paperman.models import Event, Scan, now
from paperman.storage import FileStorage, atomic_target, write_record


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
    def scan(scan_id: Identifier) -> Scan:
        return storage.get_scan(scan_id)

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
            scan.proposal = Analysis(documents=value.documents)
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

    @router.post("/api/uploads", operation_id="upload")
    async def upload(file: UploadFile) -> ActionResult:
        if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
            raise HTTPException(422, "Select a PDF file")
        filename = f"{now().strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:12]}-{Path(file.filename).name}"
        target = storage.root / "inbox" / filename
        size = 0
        with atomic_target(target) as temporary:
            with temporary.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > config.max_upload_mb * 1024 * 1024:
                        raise HTTPException(413, "PDF exceeds the upload limit")
                    output.write(chunk)
            with temporary.open("rb") as source:
                if source.read(5) != b"%PDF-":
                    raise HTTPException(422, "This file is not a PDF")
        return ActionResult(
            message="PDF received. It will appear after the worker checks the upload"
        )

    return router
