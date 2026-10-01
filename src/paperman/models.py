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


class DocumentDetails(Record):
    owner_id: Identifier = Field(
        default="unknown",
        description="Catalog ID matching the recipient, not the sender. Use unknown only if no owner matches.",
    )
    title: Name = Field(
        description="Short document type and subject, such as Electricity bill. No recipient, reference number, or date."
    )
    document_date: date | None = Field(
        default=None,
        description="Printed issue date, YYYY-MM-DD. Not a deadline or appointment date. Null if absent or uncertain.",
    )
    confidence: float = Field(ge=0, le=1, description="Confidence from 0 to 1.")
    review_reason: str = Field(
        default="",
        description="Only describe uncertainty that needs review. Empty string when clear.",
    )


class DocumentProposal(DocumentDetails):
    pages: list[Annotated[int, Field(ge=1)]] = Field(
        min_length=1, description="One-based source page numbers in original order."
    )


class Analysis(Record):
    documents: list[DocumentProposal] = Field(min_length=1)


class Enrichment(Record):
    tag_ids: list[Identifier] = Field(
        description="All relevant tag IDs from the supplied catalog only."
    )
    suggested_tags: list[Name] = Field(default_factory=list, max_length=3)
    summary: str = Field(
        min_length=1, description="A short factual summary of the document."
    )


def validate_analysis(proposal: Analysis, page_count: int, catalog: Catalog) -> None:
    pages = [page for document in proposal.documents for page in document.pages]
    if pages != list(range(1, page_count + 1)):
        raise ValueError("Every page must occur exactly once, in order, with no gaps")
    owners = {owner.id for owner in catalog.owners}
    for document in proposal.documents:
        if document.owner_id not in owners:
            raise ValueError(f"Use only these owner IDs: {sorted(owners)}")
        if not document.title.strip():
            raise ValueError("Each document needs a title")


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
