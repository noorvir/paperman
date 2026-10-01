from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from paperman.api_models import ActionResult, ScanPage
from paperman.config import Settings
from paperman.models import Analysis, Event, Identifier, Scan, now
from paperman.pipeline import validate_analysis
from paperman.storage import FileStorage, atomic_target


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
    def approve_scan(scan_id: Identifier, value: Analysis) -> Scan:
        with storage.transaction():
            scan = storage.get_scan(scan_id)
            if scan.status != "review":
                raise HTTPException(409, "This scan is not waiting for review")
            validate_analysis(value, scan.page_count, storage.catalog())
            scan.proposal = value
            scan.status = "queued"
            scan.phase = "file"
            scan.history.append(
                Event(stage="review", message="Filing details approved")
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
