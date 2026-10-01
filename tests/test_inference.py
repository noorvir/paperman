import asyncio
from collections.abc import Callable
from datetime import date

import httpx2
import pytest
from openai import AsyncOpenAI
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from paperman.inference import EndpointInference
from paperman.models import Catalog, CatalogEntry, ModelSettings


@pytest.mark.parametrize("mode", ["native", "prompted", "tool"])
def test_validated_splitting_details_and_tags(
    monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    responses = iter(
        [
            '{"document_starts":[2],"confidence":0.9,"review_reason":""}',
            '{"document_starts":[1,3],"confidence":0.9,"review_reason":""}',
            '{"owner_id":"invented","title":"Electricity bill","document_date":"2026-09-20","confidence":0.95,"review_reason":""}',
            '{"owner_id":"alice","title":"Electricity bill","document_date":"2026-09-20","confidence":0.95,"review_reason":""}',
            '{"owner_id":"unknown","title":"Appointment letter","document_date":null,"confidence":0.7,"review_reason":"Recipient is not in the catalog"}',
            '{"tag_ids":["invented"],"summary":"Electricity charges","suggested_tags":[]}',
            '{"tag_ids":["invoice","utilities"],"summary":"Electricity charges","suggested_tags":[]}',
        ]
    )

    def respond(_messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        text = next(responses)
        if info.output_tools:
            return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, text)])
        return ModelResponse(parts=[TextPart(text)])

    replace_model(monkeypatch, respond)
    inference = EndpointInference(
        ModelSettings.model_validate(
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
    result = asyncio.run(
        inference.analyze(["Invoice", "Continuation", "Letter"], catalog)
    )

    assert [item.pages for item in result.documents] == [[1, 2], [3]]
    assert [item.owner_id for item in result.documents] == ["alice", "unknown"]
    assert result.documents[0].document_date == date(2026, 9, 20)
    assert result.documents[0].confidence == 0.9
    assert result.documents[1].document_date is None
    assert result.documents[1].review_reason

    tags = asyncio.run(inference.enrich("Invoice", catalog))
    assert tags.tag_ids == ["invoice", "utilities"]
    assert tags.summary == "Electricity charges"


def test_invalid_model_output_stops_after_bounded_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    def respond(_messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
        nonlocal attempts
        attempts += 1
        return ModelResponse(
            parts=[
                TextPart('{"document_starts":[9],"confidence":1,"review_reason":""}')
            ]
        )

    replace_model(monkeypatch, respond)
    inference = EndpointInference(
        ModelSettings(
            provider="ollama",
            base_url="http://model.test/v1",
            model="test-model",
            output_mode="native",
        ),
        "local",
    )
    with pytest.raises(ValueError, match="valid data after validation retries"):
        asyncio.run(inference.analyze(["Only one page"], Catalog()))
    assert attempts == 3


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

            monkeypatch.setattr("paperman.inference.OllamaProvider", provider)
            inference = EndpointInference(
                ModelSettings(
                    provider="ollama",
                    base_url="http://model.test/v1",
                    model="test-model",
                    output_mode="native",
                ),
                "local",
            )
            with pytest.raises(ValueError, match=message):
                await inference.analyze(["One page"], Catalog())

    asyncio.run(check())


def replace_model(
    monkeypatch: pytest.MonkeyPatch,
    respond: Callable[[list[ModelMessage], AgentInfo], ModelResponse],
) -> None:
    def model(
        _name: str, *, provider: OllamaProvider | OpenAIProvider
    ) -> FunctionModel:
        return FunctionModel(respond)

    monkeypatch.setattr("paperman.inference.OpenAIChatModel", model)
