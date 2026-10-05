from datetime import UTC, date, datetime
from typing import Literal

from paperman_parser.models import Analysis, Identifier, InferenceSettings, Record
from pydantic import Field


def now() -> datetime:
    return datetime.now(UTC)


class ModelSettings(InferenceSettings):
    review_before_filing: bool = True
    ocr_languages: str = "eng"


class Event(Record):
    at: datetime = Field(default_factory=now)
    stage: str
    message: str


class Scan(Record):
    id: Identifier
    content_hash: str
    original_name: str
    scanned_at: datetime
    timestamp_source: Literal["file_mtime", "upload"] = "file_mtime"
    arrivals: list[str]
    page_count: int = 0
    status: Literal["queued", "running", "review", "failed", "complete"] = "queued"
    phase: Literal["ocr", "analyze", "file", "done"] = "ocr"
    attempts: int = 0
    proposal: Analysis | None = None
    document_ids: list[str] = Field(default_factory=list)
    filing_revision: int = 0
    history: list[Event] = Field(default_factory=list)


class Document(Record):
    id: Identifier
    scan_id: Identifier
    source_pages: list[int]
    owner_id: Identifier
    title: str
    document_date: date
    date_source: Literal["document", "scan_fallback"]
    scanned_at: datetime
    final_path: str
    user_tags: list[Identifier] = Field(default_factory=list)
    excluded_tags: list[Identifier] = Field(default_factory=list)
    generated_tags: list[Identifier] = Field(default_factory=list)
    suggested_tags: list[str] = Field(default_factory=list)
    summary: str = ""
    summary_edited: bool = False
    text_override: str | None = None
    revision: int = 0
    history: list[Event] = Field(default_factory=list)
    enrichment_status: Literal["pending", "running", "complete", "failed"] = "pending"
    enrichment_version: str = ""
    enrichment_error: str = ""


class WorkerState(Record):
    heartbeat: datetime = Field(default_factory=now)
    status: Literal["idle", "working", "error", "stopped"]
    message: str = ""


class SearchEntry(Record):
    document_id: Identifier
    text: str


class SearchIndex(Record):
    version: Literal[1] = 1
    entries: list[SearchEntry]


class LegacyTag(Record):
    id: Identifier
    name: str
    createdAt: str


class LegacyIndex(Record):
    version: Literal[1]
    tags: list[LegacyTag]
