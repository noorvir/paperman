from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


def now() -> datetime:
    return datetime.now(UTC)


class Record(BaseModel):
    model_config = ConfigDict(
        extra="forbid", json_schema_serialization_defaults_required=True
    )


Identifier = Annotated[str, Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")]
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]


CatalogIcon = Literal[
    "auto",
    "file",
    "receipt",
    "shield",
    "bank",
    "health",
    "utilities",
    "contract",
    "home",
    "car",
    "business",
    "education",
    "travel",
    "tax",
]


class CatalogEntry(Record):
    id: Identifier
    name: Name
    aliases: list[str] = Field(default_factory=list)
    icon: CatalogIcon = "auto"


class Catalog(Record):
    owners: list[CatalogEntry] = Field(
        default_factory=lambda: [CatalogEntry(id="unknown", name="Unknown")]
    )
    tags: list[CatalogEntry] = Field(
        default_factory=lambda: [
            CatalogEntry(id=name, name=name.capitalize())
            for name in [
                "invoice",
                "insurance",
                "tax",
                "health",
                "banking",
                "utilities",
                "contract",
            ]
        ]
    )


class ModelSettings(Record):
    provider: Literal["compatible", "ollama", "demo"] = "compatible"
    reasoning_effort: Literal["default", "none", "low", "medium", "high"] = "default"
    base_url: str = ""
    model: str = ""
    timeout_seconds: int = Field(default=180, ge=5, le=1800)
    output_mode: Literal["prompted", "native", "tool"] = "prompted"
    review_before_filing: bool = True
    ocr_languages: str = "eng"

    @field_validator("base_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        from urllib.parse import urlparse

        if value and (
            urlparse(value).scheme not in ("http", "https")
            or not urlparse(value).hostname
        ):
            raise ValueError("Use a complete http or https model endpoint")
        return value.rstrip("/")


class DocumentProposal(Record):
    pages: list[Annotated[int, Field(ge=1)]] = Field(min_length=1)
    owner_id: Identifier = "unknown"
    title: Name
    document_date: date | None = None
    confidence: float = Field(ge=0, le=1)
    review_reason: str = ""


class Analysis(Record):
    documents: list[DocumentProposal] = Field(min_length=1)


class Enrichment(Record):
    tag_ids: list[Identifier]
    suggested_tags: list[Name] = Field(default_factory=list)
    summary: str


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
