import asyncio
import json
from collections.abc import Callable
from datetime import date
from io import BytesIO

import httpx2
import pytest
from fpdf import FPDF
from openai import AsyncOpenAI
from PIL import Image
from pydantic_ai import BinaryContent
from pydantic_ai.messages import (
    ModelMessage,
    ModelResponse,
    TextPart,
    ToolCallPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from paperman_parser.inference import EndpointInference
from paperman_parser.models import (
    Analysis,
    Catalog,
    CatalogEntry,
    DocumentProposal,
    InferenceSettings,
)
from paperman_parser.pdf import render_pdf, select_pages


@pytest.mark.parametrize("mode", ["native", "prompted", "tool"])
def test_validated_splitting_details_and_tags(
    monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    responses = iter(
        [
            '{"document_starts":[2],"blank_pages":[],"confidence":0.9,"review_reason":""}',
            '{"document_starts":[3],"blank_pages":[1,2],"confidence":0.9,"review_reason":""}',
            '{"document_starts":[1,3],"blank_pages":[2],"confidence":0.9,"review_reason":""}',
            '{"owner_id":"invented","title":"Electricity bill","document_date":"2026-09-20","confidence":0.95,"review_reason":""}',
            '{"owner_id":"alice","title":"Electricity bill","document_date":"2026-09-20","confidence":0.95,"review_reason":""}',
            '{"owner_id":"unknown","title":"Appointment letter","document_date":null,"confidence":0.7,"review_reason":"Recipient is not in the catalog"}',
            '{"tag_ids":["invented"],"summary":"Electricity charges","suggested_tags":[]}',
            '{"tag_ids":["invoice","utilities"],"summary":"Electricity charges","suggested_tags":[]}',
        ]
    )

    requests: list[list[bytes]] = []

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        images: list[bytes] = []
        for message in messages:
            for part in message.parts:
                if isinstance(part, UserPromptPart):
                    assert not isinstance(part.content, str)
                    for content in part.content:
                        if isinstance(content, BinaryContent):
                            assert content.media_type == "image/png"
                            images.append(content.data)
                        else:
                            assert isinstance(content, str)
                            assert "OCR-SENTINEL" not in content
        requests.append(images)
        text = next(responses)
        if info.output_tools:
            return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, text)])
        return ModelResponse(parts=[TextPart(text)])

    replace_model(monkeypatch, respond)
    inference = EndpointInference(
        InferenceSettings.model_validate(
            {
                "provider": "ollama",
                "base_url": "http://model.test/v1",
                "model": "test-model",
                "output_mode": mode,
            }
        ),
        "local",
    )
    catalog = Catalog()
    catalog.owners.append(CatalogEntry(id="alice", name="Alice Smith"))
    source = pdf_bytes(["OCR-SENTINEL invoice", "", "OCR-SENTINEL letter"])
    pages = render_pdf(source)
    result = asyncio.run(inference.analyze(source, catalog))

    assert [item.pages for item in result.documents] == [[1], [3]]
    assert result.blank_pages == [2]
    assert [item.owner_id for item in result.documents] == ["alice", "unknown"]
    assert result.documents[0].document_date == date(2026, 9, 20)
    assert result.documents[0].confidence == 0.9
    assert result.documents[1].document_date is None
    assert result.documents[1].review_reason

    tags = asyncio.run(inference.enrich(select_pages(source, [1]), catalog))
    assert tags.tag_ids == ["invoice", "utilities"]
    assert tags.summary == "Electricity charges"
    assert requests == [
        pages,
        pages,
        pages,
        pages[:1],
        pages[:1],
        pages[2:],
        pages[:1],
        pages[:1],
    ]
    for data in pages:
        with Image.open(BytesIO(data)) as image:
            assert image.format == "PNG"
            assert max(image.size) == 2400


@pytest.mark.parametrize("all_blank", [False, True])
def test_blank_edges_and_entirely_blank_scans(
    monkeypatch: pytest.MonkeyPatch, all_blank: bool
) -> None:
    responses = iter(
        [
            '{"document_starts":[],"blank_pages":[1,2,3],"confidence":1,"review_reason":""}'
        ]
        if all_blank
        else [
            '{"document_starts":[2],"blank_pages":[1,3],"confidence":1,"review_reason":""}',
            '{"owner_id":"unknown","title":"Letter","document_date":null,"confidence":1,"review_reason":""}',
        ]
    )

    def respond(_messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
        return ModelResponse(parts=[TextPart(next(responses))])

    replace_model(monkeypatch, respond)
    inference = EndpointInference(
        InferenceSettings(
            base_url="http://model.test/v1", model="test", output_mode="native"
        ),
        "local",
    )
    source = pdf_bytes(["", "" if all_blank else "Letter", ""])
    result = asyncio.run(inference.analyze(source, Catalog()))
    assert result.blank_pages == ([1, 2, 3] if all_blank else [1, 3])
    assert [document.pages for document in result.documents] == (
        [] if all_blank else [[2]]
    )
    assert next(responses, None) is None


def test_invalid_model_output_stops_after_bounded_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    def respond(_messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
        nonlocal attempts
        attempts += 1
        return ModelResponse(
            parts=[
                TextPart(
                    '{"document_starts":[9],"blank_pages":[],"confidence":1,"review_reason":""}'
                )
            ]
        )

    replace_model(monkeypatch, respond)
    inference = EndpointInference(
        InferenceSettings(
            provider="ollama",
            base_url="http://model.test/v1",
            model="test-model",
            output_mode="native",
        ),
        "local",
    )
    with pytest.raises(ValueError, match="valid data after validation retries"):
        asyncio.run(inference.analyze(pdf_bytes(["Only one page"]), Catalog()))
    assert attempts == 3


def test_feedback_uses_current_draft_and_validates_page_coverage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    proposal = Analysis(
        documents=[
            DocumentProposal(pages=[1], title="My title", confidence=1),
            DocumentProposal(pages=[2], title="Terms", confidence=1),
        ],
        blank_pages=[3],
    )
    instructions = "Keep all three pages together and preserve My title."
    responses = iter(
        [
            Analysis(
                documents=[
                    DocumentProposal(pages=[1, 1, 2], title="My title", confidence=1)
                ]
            ),
            Analysis(
                documents=[
                    DocumentProposal(pages=[1, 3], title="My title", confidence=1)
                ],
                blank_pages=[2],
            ),
            Analysis(
                documents=[
                    DocumentProposal(pages=[1, 2, 3], title="My title", confidence=1)
                ]
            ),
        ]
    )
    requests = 0

    def respond(messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
        nonlocal requests
        requests += 1
        for message in messages:
            for part in message.parts:
                if isinstance(part, UserPromptPart):
                    assert not isinstance(part.content, str)
                    images = [
                        item for item in part.content if isinstance(item, BinaryContent)
                    ]
                    assert len(images) == 3
                    text = next(item for item in part.content if isinstance(item, str))
                    assert '"user_feedback": ' + json.dumps(instructions) in text
                    assert '"title": "My title"' in text
                    assert "OCR-SENTINEL" not in text
        return ModelResponse(parts=[TextPart(next(responses).model_dump_json())])

    replace_model(monkeypatch, respond)
    inference = EndpointInference(
        InferenceSettings(
            base_url="http://model.test/v1", model="test", output_mode="native"
        ),
        "local",
    )
    result = asyncio.run(
        inference.revise(
            pdf_bytes(["OCR-SENTINEL Letter", "OCR-SENTINEL Terms", ""]),
            Catalog(),
            proposal,
            instructions,
        )
    )
    assert requests == 3
    assert [document.pages for document in result.documents] == [[1, 2, 3]]
    assert result.documents[0].title == "My title"
    assert result.blank_pages == []
    assert [document.pages for document in proposal.documents] == [[1], [2]]


@pytest.mark.parametrize(
    ("failure", "message"),
    [
        ("connection", "Cannot reach the model endpoint"),
        ("timeout", "The model request timed out"),
        ("http", "The model server returned HTTP 503"),
    ],
)
def test_model_transport_failures_have_actionable_messages(
    monkeypatch: pytest.MonkeyPatch, failure: str, message: str
) -> None:
    def respond(request: httpx2.Request) -> httpx2.Response:
        assert b'"type":"image_url"' in request.content
        assert b"data:image/png;base64," in request.content
        assert b"One page" not in request.content
        if failure == "connection":
            raise httpx2.ConnectError("offline", request=request)
        if failure == "timeout":
            raise httpx2.ReadTimeout("timeout", request=request)
        return httpx2.Response(503, json={"error": {"message": "unavailable"}})

    async def check() -> None:
        async with httpx2.AsyncClient(
            transport=httpx2.MockTransport(respond)
        ) as client:

            def provider(*, base_url: str, api_key: str) -> OllamaProvider:
                return OllamaProvider(
                    openai_client=AsyncOpenAI(
                        base_url=base_url,
                        api_key=api_key,
                        http_client=client,
                        max_retries=0,
                    )
                )

            monkeypatch.setattr("paperman_parser.inference.OllamaProvider", provider)
            inference = EndpointInference(
                InferenceSettings(
                    provider="ollama",
                    base_url="http://model.test/v1",
                    model="test-model",
                    output_mode="native",
                ),
                "local",
            )
            with pytest.raises(ValueError, match=message):
                await inference.analyze(pdf_bytes(["One page"]), Catalog())

    asyncio.run(check())


def replace_model(
    monkeypatch: pytest.MonkeyPatch,
    respond: Callable[[list[ModelMessage], AgentInfo], ModelResponse],
) -> None:
    def model(
        _name: str, *, provider: OllamaProvider | OpenAIProvider
    ) -> FunctionModel:
        return FunctionModel(respond)

    monkeypatch.setattr("paperman_parser.inference.OpenAIChatModel", model)


def pdf_bytes(pages: list[str]) -> bytes:
    pdf = FPDF()
    for text in pages:
        pdf.add_page()
        pdf.set_font("Helvetica", size=14)
        pdf.multi_cell(w=180, h=10, text=text)
    return bytes(pdf.output())
