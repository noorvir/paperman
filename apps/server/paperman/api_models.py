from datetime import date
from typing import Annotated, Literal

from paperman_parser.models import (
    Analysis,
    CatalogIcon,
    Identifier,
    Name,
    Ownership,
    PageRotation,
    Record,
)
from pydantic import AliasChoices, Field

from paperman.models import Document, Scan, ScanStatus, WorkerState

PipelineStage = Literal["inbox", "ocr", "analyze", "review", "file", "tag", "ready"]
DashboardStatus = ScanStatus | Literal["unverified"]


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
    status: DashboardStatus
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
    counts: dict[DashboardStatus, int]
    pipeline_items: PipelinePage
    unverified_documents: list[Document]


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


class DocumentEdit(Ownership):
    source_pages: list[Annotated[int, Field(ge=1)]] | None = Field(
        default=None, min_length=1
    )
    rotations: list[PageRotation] = Field(default_factory=list)
    owner_ids: list[Identifier] = Field(
        min_length=1, validation_alias=AliasChoices("owner_ids", "owner_id")
    )
    revision: int = Field(ge=0)
    title: Name
    document_date: date | None
    summary: str = Field(max_length=10000)
    tag_ids: list[Identifier]
    text: str = Field(max_length=1_000_000)


class DocumentVerify(Record):
    revision: int = Field(ge=0)
    reviewer: Name


class ScanReview(Analysis):
    document_revisions: dict[Identifier, int] = Field(default_factory=dict)


class ScanReprocess(Record):
    filing_revision: int = Field(ge=0)
    document_revisions: dict[Identifier, int]


class ScanFeedback(Record):
    proposal: Analysis
    instructions: Annotated[str, Field(min_length=1, max_length=4000)]
