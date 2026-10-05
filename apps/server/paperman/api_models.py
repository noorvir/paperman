from datetime import date
from typing import Annotated, Literal

from paperman_parser.models import Analysis, CatalogIcon, Identifier, Name, Record
from pydantic import Field

from paperman.models import Document, Scan, ScanStatus, WorkerState

PipelineStage = Literal["inbox", "ocr", "analyze", "review", "file", "tag", "ready"]


class PipelineStep(Record):
    id: PipelineStage
    label: str
    status: ScanStatus
    detail: str
    count: int | None = None


class PipelineItem(Record):
    id: Identifier
    title: str
    filename: str
    status: ScanStatus
    detail: str


class PipelineScanItem(PipelineItem):
    kind: Literal["scan"] = "scan"


class PipelineDocumentItem(PipelineItem):
    kind: Literal["document"] = "document"
    document: Document


class PipelinePage(Record):
    status: ScanStatus
    items: list[
        Annotated[PipelineScanItem | PipelineDocumentItem, Field(discriminator="kind")]
    ]
    total: int
    page: int
    pages: int


class ScanDetail(Scan):
    pipeline: list[PipelineStep]


class Dashboard(Record):
    documents: int
    pending: int
    review: int
    failed: int
    enrichment_failed: int
    worker: WorkerState | None
    worker_online: bool
    ocr_available: bool
    model_configured: bool
    inbox_path: str
    counts: dict[ScanStatus, int]
    pipeline_items: PipelinePage


class DocumentPage(Record):
    items: list[Document]
    total: int
    page: int
    pages: int


class ScanPage(Record):
    items: list[Scan]
    total: int
    page: int
    pages: int


class EntryInput(Record):
    name: Name
    icon: CatalogIcon = "auto"
    aliases: list[str] = Field(default_factory=list)


class TagSelection(Record):
    tag_ids: list[Identifier]


class ActionResult(Record):
    message: str


class EntryRemoval(Record):
    status: Literal["removed", "in_use"]
    documents: int
    scans: int


class DocumentDetail(Record):
    document: Document
    text: str


class DocumentEdit(Record):
    revision: int = Field(ge=0)
    title: Name
    owner_id: Identifier
    document_date: date | None
    summary: str = Field(max_length=10000)
    tag_ids: list[Identifier]
    text: str = Field(max_length=1_000_000)


class ScanReview(Analysis):
    document_revisions: dict[Identifier, int] = Field(default_factory=dict)
