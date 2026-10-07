from pathlib import PurePosixPath

from paperman.api_models import (
    PipelineDocumentItem,
    PipelinePage,
    PipelineScanItem,
    PipelineStage,
    PipelineStep,
)
from paperman.models import Document, Scan, ScanStatus


def pipeline_overview(
    scans: list[Scan],
    documents: list[Document],
    status: ScanStatus,
    page: int,
) -> tuple[dict[ScanStatus, int], PipelinePage]:
    groups: dict[ScanStatus, list[PipelineScanItem | PipelineDocumentItem]] = {
        key: [] for key in STATUS_LABELS
    }
    by_id = {scan.id: scan for scan in scans}
    for scan in sorted(
        scans, key=lambda item: (item.scanned_at, item.id), reverse=True
    ):
        if scan.status == "complete":
            continue
        detail = "Original scan is saved"
        if scan.status == "queued":
            detail = "Waiting for the worker"
        if scan.status == "review":
            detail = "Check the page groups, owners, and dates"
        if scan.status == "failed" and scan.history:
            detail = scan.history[-1].message
        groups[scan.status].append(
            PipelineScanItem(
                id=scan.id,
                title=scan.original_name,
                filename=scan.original_name,
                status=scan.status,
                detail=detail,
            )
        )

    for document in sorted(
        documents, key=lambda doc: (doc.scanned_at, doc.id), reverse=True
    ):
        scan = by_id.get(document.scan_id)
        if scan is not None and (
            scan.status != "complete" or document.id not in scan.document_ids
        ):
            continue
        document_status: ScanStatus = "queued"
        if document.enrichment_status != "pending":
            document_status = document.enrichment_status
        groups[document_status].append(
            PipelineDocumentItem(
                document=document,
                id=document.id,
                title=document.title,
                filename=PurePosixPath(document.final_path).name,
                status=document_status,
                detail=document.enrichment_error
                or document.summary
                or STATUS_LABELS[document_status],
            )
        )

    counts: dict[ScanStatus, int] = {key: len(items) for key, items in groups.items()}
    items = groups[status]
    pages = max(1, (len(items) + 24) // 25)
    page = min(page, pages)
    return counts, PipelinePage(
        status=status,
        items=items[(page - 1) * 25 : page * 25],
        total=len(items),
        page=page,
        pages=pages,
    )


def scan_progress(scan: Scan, documents: list[Document]) -> list[PipelineStep]:
    current = scan_stage(scan)
    status = scan.status
    if scan.status == "complete":
        current = "tag"
        status = "queued"
        if any(doc.enrichment_status == "failed" for doc in documents):
            status = "failed"
        elif any(doc.enrichment_status == "running" for doc in documents):
            status = "running"
        elif all(doc.enrichment_status == "complete" for doc in documents):
            current = "ready"
            status = "complete"

    current_index = list(STAGES).index(current)
    steps: list[PipelineStep] = []
    for index, (id, label) in enumerate(STAGES.items()):
        step_status: ScanStatus = "queued"
        detail = "Waiting"
        if index < current_index or current == "ready":
            step_status = "complete"
            detail = "Done"
        elif id == current:
            step_status = status
            detail = STATUS_LABELS[status]

        if id == "review" and index < current_index:
            if any(event.stage == "review" for event in scan.history):
                detail = "Approved"
        if id == "tag" and scan.status == "complete" and documents:
            complete = sum(doc.enrichment_status == "complete" for doc in documents)
            failed = sum(doc.enrichment_status == "failed" for doc in documents)
            detail = f"{complete} of {len(documents)} done"
            if failed:
                detail += f" · {failed} failed"
        if id == "ready" and current == "ready":
            detail = f"{len(documents)} documents"

        steps.append(
            PipelineStep(id=id, label=label, status=step_status, detail=detail)
        )
    return steps


def scan_stage(scan: Scan) -> PipelineStage:
    if scan.status == "review":
        return "review"
    if scan.status == "queued" and scan.attempts == 0:
        return "inbox"
    if scan.phase == "done":
        return "ready"
    return scan.phase


STAGES: dict[PipelineStage, str] = {
    "inbox": "Inbox",
    "analyze": "Analysis",
    "ocr": "OCR",
    "review": "Review",
    "file": "File",
    "tag": "Tag",
    "ready": "Ready",
}

STATUS_LABELS: dict[ScanStatus, str] = {
    "queued": "Waiting",
    "running": "Processing",
    "review": "Needs review",
    "failed": "Failed",
    "complete": "Complete",
}
