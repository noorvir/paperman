from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from pathlib import PurePosixPath
from typing import Literal, Self

from paperman_parser.models import (
    Analysis,
    Identifier,
    InferenceSettings,
    Name,
    Ownership,
    PageRotation,
    ProcessingUsage,
    Record,
    UsageAllocation,
)
from pydantic import AliasChoices, Field, model_validator

ScanStatus = Literal["queued", "running", "review", "failed", "complete"]


def now() -> datetime:
    return datetime.now(UTC)


def personal_inbox_id(account_id: str) -> str:
    return f"personal-{sha256(account_id.encode()).hexdigest()[:24]}"


class ModelSettings(InferenceSettings):
    review_before_filing: bool = False
    ocr_languages: str = "eng"
    time_format: Literal["24h", "12h"] = "24h"


class Event(Record):
    at: datetime = Field(default_factory=now)
    stage: str
    message: str


class ScanUsage(ProcessingUsage):
    processing_run: int = Field(default=1, ge=1)


class Inbox(Record):
    id: Identifier
    name: Name
    account_id: Identifier | None = None
    routing_owner_ids: list[Identifier] = Field(default_factory=list)
    time_format: Literal["24h", "12h"] | None = None

    @model_validator(mode="after")
    def check_identity(self) -> Self:
        expected = (
            "shared" if self.account_id is None else personal_inbox_id(self.account_id)
        )
        if self.id != expected:
            raise ValueError("An inbox ID must match its account")
        return self


class Inboxes(Record):
    items: list[Inbox] = Field(
        default_factory=lambda: [Inbox(id="shared", name="Shared inbox")]
    )

    @model_validator(mode="after")
    def check_unique(self) -> Self:
        ids = [inbox.id for inbox in self.items]
        if len(ids) != len(set(ids)) or "shared" not in ids:
            raise ValueError("Use one shared inbox and one inbox per account")
        return self


class Scan(Record):
    id: Identifier
    inbox_id: Identifier = "shared"
    content_hash: str
    original_name: str
    scanned_at: datetime
    timestamp_source: Literal["file_mtime", "upload"] = "file_mtime"
    arrivals: list[str]
    page_count: int = 0
    status: ScanStatus = "queued"
    phase: Literal["ocr", "analyze", "file", "done"] = "analyze"
    ocr_rotations: list[PageRotation] | None = None
    attempts: int = 0
    proposal: Analysis | None = None
    document_ids: list[str] = Field(default_factory=list)
    filing_revision: int = 0
    processing_run: int = Field(default=1, ge=1)
    filing_paths: dict[str, str] = Field(default_factory=dict)
    history: list[Event] = Field(default_factory=list)
    processing: list[ScanUsage] = Field(default_factory=list)


class Verification(Record):
    at: datetime
    by: Name


class Document(Ownership):
    inbox_id: Identifier = "shared"
    access_user_ids: list[Identifier] = Field(default_factory=list)
    delivery_status: Literal["review", "delivered"] = "review"
    verification: Verification | None = None
    manual_rotations: list[PageRotation] = Field(default_factory=list)
    owner_ids: list[Identifier] = Field(
        min_length=1, validation_alias=AliasChoices("owner_ids", "owner_id")
    )
    id: Identifier
    scan_id: Identifier
    source_pages: list[int]
    processing_run: int = Field(default=1, ge=1)
    page_rotations: list[PageRotation] = Field(default_factory=list)
    title: str
    document_date: date
    date_source: Literal["document", "scan_fallback"]
    scanned_at: datetime
    final_path: str
    processed_at: datetime | None = None
    user_tags: list[Identifier] = Field(default_factory=list)
    excluded_tags: list[Identifier] = Field(default_factory=list)
    generated_tags: list[Identifier] = Field(default_factory=list)
    suggested_tags: list[str] = Field(default_factory=list)
    summary: str = ""
    summary_edited: bool = False
    text_override: str | None = None
    revision: int = 0
    pdf_revision: int = 0
    history: list[Event] = Field(default_factory=list)
    enrichment_status: Literal["pending", "running", "complete", "failed"] = "pending"
    enrichment_version: str = ""
    enrichment_error: str = ""
    processing: list[UsageAllocation] = Field(default_factory=list)

    @model_validator(mode="after")
    def restore_processing_time(self) -> Self:
        if self.processed_at is not None:
            return self
        for event in reversed(self.history):
            if event.stage == "tag" and event.message == "Tags and summary updated":
                self.processed_at = event.at
                return self
        if self.enrichment_status == "complete":
            self.processed_at = max(
                (
                    item.call.started_at + timedelta(seconds=item.call.seconds)
                    for item in self.processing
                    if item.call.stage == "tagging" and item.call.status == "complete"
                ),
                default=None,
            )
        return self

    @property
    def file_paths(self) -> list[str]:
        filename = PurePosixPath(self.final_path).name
        return list(
            dict.fromkeys(
                [
                    self.final_path,
                    *[f"documents/{owner}/{filename}" for owner in self.owner_ids],
                ]
            )
        )


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
