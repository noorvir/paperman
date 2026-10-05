# PaperMan parser

A standalone Python package for searchable PDFs, document groups, recipient and issue-date extraction, and later tagging. It has no server dependency and reads no PaperMan storage or environment settings.

## Interface

```python
from paperman_parser import parse
from paperman_parser.inference import EndpointInference
from paperman_parser.ocr import LocalOCR

# The caller supplies bytes, a catalog, settings, and a credential.
inference = EndpointInference(settings, api_key)
result = await parse(pdf_bytes, catalog=catalog, ocr=LocalOCR(), inference=inference)

result.content.pdf         # Searchable PDF bytes, with the original page count
result.content.pages       # Ordered page text
result.analysis.documents  # Page groups, owner, title, issue date, review signals

# Run this separately when the tag catalog or classifier changes.
tags = await inference.enrich(document_text, catalog)
```

`settings` is an `InferenceSettings`; `catalog` is a `Catalog`, both from `paperman_parser.models`. An issue date can be absent. The parser does not read the clock or substitute an intake date. Page numbers are one-based, contiguous, and cover every source page exactly once. Splitting returns page groups; the server creates the final files after review.

The server uses the same `OCR.searchable` and `Inference.analyze` stages separately so it can save OCR output before a model request. It owns intake, saved checkpoints, review, date fallback, filenames, publication, and user tag overrides. An API caller can supply the same bytes without a scan record or inbox.

`OCR` and `Inference` are injected interfaces. The current implementations are `LocalOCR`, `EndpointInference`, and a deterministic `DemoInference`. Endpoint settings and credentials are explicit. OCR uses temporary files and removes them after the call. No parser result is saved automatically.

Calls have no persistent application side effects. This does not guarantee identical AI answers or byte-identical regenerated PDFs. Temperature zero does not establish determinism. The caller owns caching and idempotent publication; compare runs using source hashes, catalog contents, OCR languages, endpoint/model settings, dependency versions, and the code revision.

## Current method

1. OCRmyPDF/Tesseract adds a text layer, preserves existing text, and checks page count. It fails if the whole PDF has no readable text. The server also requires review for each page without text, so a blank back or missed OCR cannot be silently accepted by automatic filing. This does not prove that all visible text was recognized correctly.
2. One model request identifies document start pages from all page text. Code converts those starts into complete groups. Blank backs stay with the preceding document.
3. One request per group returns the recipient from the owner catalog, a short title, and the printed issue date. A due date or appointment date is not an issue date. Unmatched recipients use `unknown`.
4. A separate request per document returns catalog tags, suggested new tags, and a summary.

For six documents, this is normally 13 model requests: one split, six metadata requests, and six enrichment requests. Validation can cause up to two retries per request. The current splitter has no context windows. The eight public PDFs were evaluated with local Gemma 4. See [measured results](test-data/public-pdfs/results/README.md). Large batches can exceed the configured model context; the server reports request failures for retry.

## Checks

Run from the repository root:

```sh
uv sync --project packages/parser
uv run --directory packages/parser pytest
uv run --directory packages/parser basedpyright
uv run --directory packages/parser ruff check paperman_parser tests scripts
```

These checks run without the server, FastAPI, a data directory, or a live model. OCR tests need local Tesseract. Model transport tests replace only the external model boundary. They test contracts and failure handling, not model accuracy.

The eight public PDFs and label status are described in [test data](test-data/public-pdfs/README.md). All 18 page transcripts and 13 document labels were frozen before evaluation. Labels were written by the agent and have not had human review. The existing server integration script also checks fictional mixed mail against a configured live model.

## DocJev research — 2 October 2026

[DocJev](https://github.com/jerryjliu/docjev) is a Python library. It normalizes OCR page text, asks for categories and document boundaries, and exports the selected pages. Its Jev adapter uses TypeSafe's hosted API. Local OCR does not make that adapter private or offline. Jev is deferred. No Jev adapter has been added here. See its [architecture](https://github.com/jerryjliu/docjev/blob/main/docs/architecture.md) and [engine](https://github.com/jerryjliu/docjev/blob/main/src/jev_docs/engines/jev.py).

The engine asks two typed questions per nonblank page: its category, and whether it starts a new document (except the first page). A packet can fit in one request. Longer packets use overlapping context windows; each page gets one result. Category descriptions guide the choices. A boundary can separate two adjacent invoices even though their category is the same.

Its [split assembly](https://github.com/jerryjliu/docjev/blob/main/src/jev_docs/split.py) also forces a split when the category changes, and makes separate groups for blank pages. These rules differ from PaperMan's blank-back policy and can cause extra splits. Do not adopt them without a comparison. Classification into one category also does not replace recipient/date extraction or multiple tags.

The [real-document pilot](https://github.com/jerryjliu/docjev/blob/main/benchmarks/results/real-small-v1-run01/report.md) reports:

| Measure                           |    Jev | GPT-5.6 Luna |
| --------------------------------- | -----: | -----------: |
| Correct whole-document categories |  40/40 |        40/40 |
| Exactly correct packets           |    7/8 |          8/8 |
| Median classification decision    | 139 ms |       794 ms |
| Median packet decision            | 210 ms |     1,352 ms |

This small test reused 40 public-sector originals in eight constructed packets. Times exclude OCR. Labels had no human review, provider caches were uncontrolled, and repeat stability was not measured. These figures do not establish performance on household scans or our GPU.

After the Gemma baseline, consider category descriptions, batched boundary questions, bounded context windows, per-page visual blank checks, separate category/boundary review signals, and per-stage timing. Keep source hashes and labels fixed across comparisons. The [code licence](https://github.com/jerryjliu/docjev/blob/main/LICENSE) is Apache-2.0; preserve its notices if code is copied. No upstream code was copied for this extraction.
