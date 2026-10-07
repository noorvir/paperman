import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from itertools import pairwise
from time import perf_counter
from typing import Annotated

from openai import APIConnectionError, APITimeoutError
from pydantic import BaseModel, Field
from pydantic_ai import (
    Agent,
    BinaryContent,
    ModelRetry,
    NativeOutput,
    PromptedOutput,
    ToolOutput,
    capture_run_messages,
)
from pydantic_ai.exceptions import (
    ModelAPIError,
    ModelHTTPError,
    UnexpectedModelBehavior,
)
from pydantic_ai.messages import ModelMessage, ModelResponse
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIChatModelSettings
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import RunUsage

from paperman_parser.models import (
    Analysis,
    Catalog,
    DocumentDetails,
    DocumentProposal,
    Enrichment,
    InferenceSettings,
    PageRotation,
    ProcessingStage,
    ProcessingUsage,
    Record,
    validate_analysis,
    validate_rotations,
)
from paperman_parser.pdf import pages_with_text, render_pdf, rotate_pages
from paperman_parser.prompt import Prompt
from paperman_parser.prompt.details import details
from paperman_parser.prompt.enrich import enrich
from paperman_parser.prompt.revise import revise
from paperman_parser.prompt.split import split
from paperman_parser.usage import estimate_cost

logger = logging.getLogger(__name__)


class EndpointInference:
    def __init__(
        self,
        settings: InferenceSettings,
        api_key: str,
        record_usage: Callable[[ProcessingUsage], None] | None = None,
    ) -> None:
        self.settings = settings
        self.api_key = api_key
        self.record_usage = record_usage

    @property
    def version(self) -> str:
        return f"organization-v7-owners-orientation:{self.settings.base_url}:{self.settings.model}"

    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis:
        pages = await asyncio.to_thread(render_pdf, source)
        text_pages = await asyncio.to_thread(pages_with_text, source)

        def validate_split(result: ScanSplit) -> None:
            validate_rotations(result.page_rotations, len(pages))
            blanks = result.blank_pages
            if blanks != sorted(set(blanks)) or any(
                page > len(pages) for page in blanks
            ):
                raise ValueError(
                    "Return unique blank page numbers in source order within the scan"
                )
            if text_pages.intersection(blanks):
                raise ValueError(
                    "Pages with a text layer cannot be omitted as blank. Keep them in a document"
                )
            kept = [page for page in range(1, len(pages) + 1) if page not in blanks]
            starts = result.document_starts
            if not kept:
                if starts:
                    raise ValueError("An entirely blank scan has no document starts")
                return
            if (
                not starts
                or starts[0] != kept[0]
                or starts != sorted(set(starts))
                or not set(starts) <= set(kept)
            ):
                raise ValueError(
                    "Start at the first nonblank page. Return unique nonblank document starts in source order"
                )

        boundaries = await self._request(
            ScanSplit,
            split(pages),
            validate_split,
            stage="split",
            source_pages=list(range(1, len(pages) + 1)),
        )
        owners = {owner.id for owner in catalog.owners}
        if boundaries.page_rotations:
            upright = await asyncio.to_thread(
                rotate_pages, source, boundaries.page_rotations
            )
            pages = await asyncio.to_thread(render_pdf, upright)

        def validate_owner(result: DocumentDetails) -> None:
            if not set(result.owner_ids) <= owners:
                raise ValueError(f"Use only these owner IDs: {sorted(owners)}")

        starts = [*boundaries.document_starts, len(pages) + 1]
        documents: list[DocumentProposal] = []
        for start, stop in pairwise(starts):
            source_pages = [
                page
                for page in range(start, stop)
                if page not in boundaries.blank_pages
            ]
            images = [pages[page - 1] for page in source_pages]
            result = await self._request(
                DocumentDetails,
                details(images, catalog.owners),
                validate_owner,
                stage="details",
                source_pages=source_pages,
            )
            documents.append(
                DocumentProposal(
                    pages=source_pages,
                    owner_ids=result.owner_ids,
                    title=result.title,
                    document_date=result.document_date,
                    confidence=min(boundaries.confidence, result.confidence),
                    review_reason=" ".join(
                        reason
                        for reason in (boundaries.review_reason, result.review_reason)
                        if reason
                    ),
                )
            )
        analysis = Analysis(
            documents=documents,
            blank_pages=boundaries.blank_pages,
            page_rotations=boundaries.page_rotations,
        )
        validate_analysis(analysis, len(pages), catalog)
        return analysis

    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment:
        pages = await asyncio.to_thread(render_pdf, source)

        def validate_tags(result: Enrichment) -> None:
            allowed = {tag.id for tag in catalog.tags}
            if not set(result.tag_ids) <= allowed:
                raise ValueError(
                    f"Use only these tag_ids: {sorted(allowed)}. Put new tag names in suggested_tags."
                )

        return await self._request(
            Enrichment,
            enrich(pages, catalog.tags),
            validate_tags,
            stage="tagging",
            source_pages=list(range(1, len(pages) + 1)),
        )

    async def revise(
        self, source: bytes, catalog: Catalog, proposal: Analysis, instructions: str
    ) -> Analysis:
        pages = await asyncio.to_thread(render_pdf, source)
        text_pages = await asyncio.to_thread(pages_with_text, source)
        validate_analysis(proposal, len(pages), catalog)

        def validate_revision(result: Analysis) -> None:
            validate_analysis(result, len(pages), catalog)
            if text_pages.intersection(result.blank_pages):
                raise ValueError(
                    "Pages with a text layer cannot be omitted as blank. Keep them in a document"
                )

        return await self._request(
            Analysis,
            revise(pages, catalog, proposal, instructions),
            validate_revision,
            stage="review",
            source_pages=list(range(1, len(pages) + 1)),
        )

    async def _request[T: BaseModel](
        self,
        output: type[T],
        prompt: Prompt,
        validate: Callable[[T], None] | None = None,
        *,
        stage: ProcessingStage,
        source_pages: list[int],
    ) -> T:
        if not self.settings.base_url or not self.settings.model:
            raise ValueError(
                "Configure the model endpoint and model name in Settings, then retry"
            )
        if self.settings.provider == "ollama":
            provider = OllamaProvider(
                base_url=self.settings.base_url, api_key=self.api_key
            )
        else:
            provider = OpenAIProvider(
                base_url=self.settings.base_url, api_key=self.api_key
            )
        model = OpenAIChatModel(self.settings.model, provider=provider)
        output_type = PromptedOutput(output)
        if self.settings.output_mode == "native":
            result_type = NativeOutput(output, strict=True)
        elif self.settings.output_mode == "tool":
            result_type = ToolOutput(output)
        else:
            result_type = output_type
        request_settings = OpenAIChatModelSettings(
            timeout=self.settings.timeout_seconds, temperature=0, max_tokens=8192
        )
        if self.settings.reasoning_effort != "default":
            request_settings["openai_reasoning_effort"] = self.settings.reasoning_effort
        agent = Agent(
            model,
            output_type=result_type,
            instructions=prompt.instructions,
            retries=2,
            model_settings=request_settings,
        )
        if validate is not None:

            @agent.output_validator
            def validate_output(result: T) -> T:
                try:
                    validate(result)
                except ValueError as error:
                    raise ModelRetry(str(error)) from error
                return result

        content: list[str | BinaryContent] = [prompt.text]
        content.extend(
            BinaryContent(data=image, media_type="image/png") for image in prompt.images
        )
        started_at = datetime.now(UTC)
        started = perf_counter()
        usage = RunUsage()
        messages: list[ModelMessage] = []
        succeeded = False
        transport_failed = False
        try:
            with capture_run_messages() as messages:
                result = await agent.run(content, usage=usage)
            succeeded = True
        except ModelHTTPError as error:
            transport_failed = True
            raise ValueError(
                f"The model server returned HTTP {error.status_code}. Check the endpoint, model name, and credentials"
            ) from error
        except ModelAPIError as error:
            transport_failed = True
            if isinstance(error.__cause__, APITimeoutError):
                message = "The model request timed out. Check the GPU server or increase its timeout, then retry"
            elif isinstance(error.__cause__, APIConnectionError):
                message = "Cannot reach the model endpoint. Check the GPU server and network, then retry"
            else:
                message = "The model server could not complete the request. Check its log and retry"
            raise ValueError(message) from error
        except UnexpectedModelBehavior as error:
            raise ValueError(
                "The model did not return valid data after validation retries. Check its output format or choose another model"
            ) from error
        finally:
            if self.record_usage is not None:
                responses = [
                    item for item in messages if isinstance(item, ModelResponse)
                ]
                reported = usage.total_tokens > 0
                requests = usage.requests + int(transport_failed)
                complete = (
                    bool(responses)
                    and len(responses) == requests
                    and all(item.usage.total_tokens > 0 for item in responses)
                )
                call = ProcessingUsage(
                    started_at=started_at,
                    stage=stage,
                    source_pages=source_pages,
                    model=self.settings.model,
                    base_url=self.settings.base_url,
                    status="complete" if succeeded else "failed",
                    seconds=perf_counter() - started,
                    requests=requests,
                    input_tokens=usage.input_tokens if reported else None,
                    cached_input_tokens=usage.cache_read_tokens if reported else None,
                    output_tokens=usage.output_tokens if reported else None,
                    token_details=usage.details,
                    usage_complete=complete,
                    pricing=self.settings.pricing,
                )
                call.estimated_cost_usd = estimate_cost(call)
                try:
                    self.record_usage(call)
                except Exception:
                    logger.exception("Could not record processing usage for %s", stage)
        return result.output


class ScanSplit(Record):
    page_rotations: list[PageRotation] = Field(default_factory=list)
    document_starts: list[Annotated[int, Field(ge=1)]] = Field(
        description="First nonblank source page of each document, in order. Empty only for an entirely blank scan.",
    )
    blank_pages: list[Annotated[int, Field(ge=1)]] = Field(
        description="Source page numbers that are clearly blank, in order. Keep all uncertain pages."
    )
    confidence: float = Field(ge=0, le=1)
    review_reason: str
