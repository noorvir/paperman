import asyncio
from datetime import date
from decimal import Decimal

import httpx2
import pytest
from openai import AsyncOpenAI
from pydantic import JsonValue
from pydantic_ai.providers.openai import OpenAIProvider
from test_inference import pdf_bytes

from paperman_parser.inference import EndpointInference
from paperman_parser.models import (
    Catalog,
    InferenceSettings,
    ModelPricing,
    ProcessingUsage,
)
from paperman_parser.usage import allocate_usage


@pytest.mark.parametrize("scenario", ["retries", "missing", "failure", "wrong-price"])
def test_reported_usage_and_cost_include_validation_retries(
    monkeypatch: pytest.MonkeyPatch,
    scenario: str,
) -> None:
    attempts = 0
    calls: list[ProcessingUsage] = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        nonlocal attempts
        attempts += 1
        if scenario == "failure" and attempts == 2:
            raise httpx2.ConnectError("offline", request=request)
        tags = '["invalid"]' if attempts == 1 else '["invoice"]'
        content = '{"tag_ids":' + tags + ',"summary":"Invoice","suggested_tags":[]}'
        response: dict[str, JsonValue] = {
            "id": "test",
            "object": "chat.completion",
            "created": 1,
            "model": "test",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "stop",
                    "message": {"role": "assistant", "content": content},
                }
            ],
        }
        if scenario != "missing":
            response["usage"] = {
                "prompt_tokens": 1000,
                "completion_tokens": 100,
                "total_tokens": 1100,
                "prompt_tokens_details": {"cached_tokens": 200},
            }
        return httpx2.Response(200, json=response)

    async def check() -> None:
        async with httpx2.AsyncClient(
            transport=httpx2.MockTransport(respond)
        ) as client:

            def provider(*, base_url: str, api_key: str) -> OpenAIProvider:
                return OpenAIProvider(
                    openai_client=AsyncOpenAI(
                        base_url=base_url,
                        api_key=api_key,
                        http_client=client,
                        max_retries=0,
                    )
                )

            monkeypatch.setattr("paperman_parser.inference.OpenAIProvider", provider)
            settings = InferenceSettings(
                base_url="http://model.test/v1",
                model="test",
                output_mode="native",
                pricing=ModelPricing(
                    model="other-model" if scenario == "wrong-price" else "test",
                    base_url="http://model.test/v1",
                    input_usd_per_million=Decimal("0.15"),
                    output_usd_per_million=Decimal("0.50"),
                    cached_input_usd_per_million=Decimal("0.03"),
                    source="test",
                    checked_on=date(2026, 10, 5),
                ),
            )
            inference = EndpointInference(settings, "test", calls.append)
            if scenario == "failure":
                with pytest.raises(ValueError, match="Cannot reach"):
                    await inference.enrich(pdf_bytes(["Invoice"]), Catalog())
            else:
                result = await inference.enrich(pdf_bytes(["Invoice"]), Catalog())
                assert result.tag_ids == ["invoice"]

    asyncio.run(check())
    assert attempts == 2
    assert len(calls) == 1
    call = calls[0]
    assert call.requests == 2
    assert call.stage == "tagging" and call.source_pages == [1]
    assert call.status == ("failed" if scenario == "failure" else "complete")
    if scenario == "missing":
        assert call.input_tokens is None and call.estimated_cost_usd is None
        assert not call.usage_complete
    else:
        responses = 1 if scenario == "failure" else 2
        assert call.input_tokens == responses * 1000
        assert call.cached_input_tokens == responses * 200
        assert call.output_tokens == responses * 100
        assert call.usage_complete == (scenario != "failure")
        if scenario == "wrong-price":
            assert call.estimated_cost_usd is None
        else:
            assert call.estimated_cost_usd == Decimal("0.000176") * responses


def test_shared_scan_costs_include_blank_pages_and_retries() -> None:
    first = ProcessingUsage(
        stage="split",
        source_pages=[1, 2, 3, 4],
        model="test",
        base_url="test",
        status="failed",
        seconds=1,
        estimated_cost_usd=Decimal("0.03"),
    )
    second = first.model_copy(update={"id": "second", "status": "complete"})
    details = first.model_copy(
        update={"id": "details", "stage": "details", "source_pages": [4]}
    )
    calls = [first, second, details]
    left = allocate_usage(calls, [1, 3], [1, 3, 4])
    right = allocate_usage(calls, [4], [1, 3, 4])
    assert sum(item.estimated_cost_usd or Decimal(0) for item in left) == Decimal(
        "0.04"
    )
    assert sum(item.estimated_cost_usd or Decimal(0) for item in right) == Decimal(
        "0.05"
    )
    assert len(left) == 2 and len(right) == 3
    removed = first.model_copy(update={"source_pages": [2]})
    remaining = allocate_usage([removed], [1, 3], [1, 3, 4])
    assert remaining[0].estimated_cost_usd == Decimal("0.02")
