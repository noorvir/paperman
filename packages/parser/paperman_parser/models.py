from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


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


class ModelPricing(Record):
    model: str
    base_url: str
    input_usd_per_million: Decimal = Field(ge=0)
    output_usd_per_million: Decimal = Field(ge=0)
    cached_input_usd_per_million: Decimal | None = Field(default=None, ge=0)
    source: str
    checked_on: date


ProcessingStage = Literal[
    "ocr", "split", "details", "tagging", "review", "transcription"
]


class ProcessingUsage(Record):
    id: str = Field(default_factory=lambda: uuid4().hex)
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    stage: ProcessingStage
    source_pages: list[int]
    model: str
    base_url: str
    status: Literal["complete", "failed"]
    seconds: float = Field(ge=0)
    requests: int = Field(default=0, ge=0)
    input_tokens: int | None = Field(default=None, ge=0)
    cached_input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    token_details: dict[str, int] = Field(default_factory=dict)
    usage_complete: bool = False
    pricing: ModelPricing | None = None
    estimated_cost_usd: Decimal | None = Field(default=None, ge=0)


class UsageAllocation(Record):
    call: ProcessingUsage
    share: Decimal = Field(gt=0, le=1)
    estimated_cost_usd: Decimal | None = Field(default=None, ge=0)


class InferenceSettings(Record):
    provider: Literal["compatible", "ollama", "demo"] = "compatible"
    reasoning_effort: Literal["default", "none", "low", "medium", "high"] = "default"
    base_url: str = ""
    model: str = ""
    timeout_seconds: int = Field(default=180, ge=5, le=1800)
    output_mode: Literal["prompted", "native", "tool"] = "prompted"
    pricing: ModelPricing | None = None

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
    documents: list[DocumentProposal]
    blank_pages: list[Annotated[int, Field(ge=1)]] = Field(
        default_factory=list,
        description="Confirmed blank source pages omitted from filed documents. Originals retain every page.",
    )


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
    blanks = proposal.blank_pages
    source_pages = list(range(1, page_count + 1))
    if (
        page_count < 1
        or blanks != sorted(set(blanks))
        or not set(blanks) <= set(source_pages)
        or pages != [page for page in source_pages if page not in blanks]
    ):
        raise ValueError(
            "Every page must occur exactly once, in order, in a document or in blank_pages"
        )
    owners = {owner.id for owner in catalog.owners}
    for document in proposal.documents:
        if document.owner_id not in owners:
            raise ValueError(f"Use only these owner IDs: {sorted(owners)}")
        if not document.title.strip():
            raise ValueError("Each document needs a title")
