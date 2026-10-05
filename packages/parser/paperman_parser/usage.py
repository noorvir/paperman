from collections.abc import Sequence
from decimal import Decimal

from paperman_parser.models import ProcessingUsage, UsageAllocation


def allocate_usage(
    calls: Sequence[ProcessingUsage],
    source_pages: Sequence[int],
    retained_pages: Sequence[int],
) -> list[UsageAllocation]:
    allocations: list[UsageAllocation] = []
    for call in calls:
        eligible = set(call.source_pages).intersection(retained_pages)
        # Calls for pages removed during review remain part of the scan's cost.
        if not eligible:
            eligible = set(retained_pages)
        covered = eligible.intersection(source_pages)
        if not covered:
            continue
        share = Decimal(len(covered)) / Decimal(len(eligible))
        cost = None
        if call.estimated_cost_usd is not None:
            cost = call.estimated_cost_usd * share
        allocations.append(
            UsageAllocation(call=call, share=share, estimated_cost_usd=cost)
        )
    return allocations


def estimate_cost(call: ProcessingUsage) -> Decimal | None:
    pricing = call.pricing
    if (
        pricing is None
        or pricing.model != call.model
        or pricing.base_url.rstrip("/") != call.base_url.rstrip("/")
        or call.input_tokens is None
        or call.output_tokens is None
        or call.cached_input_tokens is None
        or call.cached_input_tokens > call.input_tokens
    ):
        return None
    cached_cost = Decimal(0)
    if call.cached_input_tokens:
        if pricing.cached_input_usd_per_million is None:
            return None
        cached_cost = call.cached_input_tokens * pricing.cached_input_usd_per_million
    fresh_tokens = call.input_tokens - call.cached_input_tokens
    return (
        fresh_tokens * pricing.input_usd_per_million
        + cached_cost
        + call.output_tokens * pricing.output_usd_per_million
    ) / Decimal(1_000_000)
