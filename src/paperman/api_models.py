from typing import Literal

from pydantic import Field

from paperman.models import (
    CatalogIcon,
    Document,
    Identifier,
    Name,
    Record,
    Scan,
    WorkerState,
)


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
