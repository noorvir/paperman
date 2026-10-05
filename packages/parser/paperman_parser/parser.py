from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Protocol

from paperman_parser.models import Analysis, Catalog, Enrichment, validate_analysis
from paperman_parser.ocr import OCR, SearchableDocument


async def parse(
    source: bytes,
    *,
    catalog: Catalog,
    ocr: OCR,
    inference: Inference,
    languages: str = "eng",
) -> ParsedDocument:
    """Return searchable content and proposals without saving application state.

    Page numbers refer to the input PDF. Missing issue dates remain absent.
    The caller owns review, date fallback, persistence, and later enrichment.
    """
    content = await asyncio.to_thread(ocr.searchable, source, languages)
    analysis = await inference.analyze(content.pdf, catalog)
    validate_analysis(analysis, len(content.pages), catalog)
    return ParsedDocument(content=content, analysis=analysis)


class Inference(Protocol):
    async def analyze(self, source: bytes, catalog: Catalog) -> Analysis: ...
    async def enrich(self, source: bytes, catalog: Catalog) -> Enrichment: ...
    @property
    def version(self) -> str: ...


@dataclass(frozen=True)
class ParsedDocument:
    content: SearchableDocument
    analysis: Analysis
