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
result.analysis.blank_pages # Confirmed blank source pages omitted from final files

# Run this separately when the tag catalog or classifier changes.
tags = await inference.enrich(document_pdf_bytes, catalog)
```

`settings` is an `InferenceSettings`; `catalog` is a `Catalog`, both from `paperman_parser.models`. An issue date can be absent. The parser does not read the clock or substitute an intake date. Page numbers are one-based source numbers. Each source page must appear exactly once, either in an ordered document group or in `blank_pages`. Groups can have gaps only for confirmed blank pages. Splitting returns page groups; the server creates the final files after review.

The server uses the same `OCR.searchable` and `Inference.analyze` stages separately so it can save OCR output before a model request. Both inference methods accept PDF bytes. The endpoint adapter renders visible pages to ordered PNGs with a 1600-pixel longest edge using Poppler. Only these images, instructions, page counts, and catalog values go to the model. OCR text and user text corrections stay local for search and review. The model must support multiple images; there is no text fallback. The server owns intake, saved checkpoints, review, date fallback, filenames, publication, and user tag overrides. An API caller can supply the same bytes without a scan record or inbox.

`OCR` and `Inference` are injected interfaces. The current implementations are `LocalOCR`, `EndpointInference`, and a deterministic `DemoInference`. Endpoint settings and credentials are explicit. OCR uses temporary files and removes them after the call. No parser result is saved automatically. Rendering also uses temporary files which are removed after each call. The demo adapter is a local stub that reads embedded sample text; it sends nothing to a model.

Calls have no persistent application side effects. This does not guarantee identical AI answers or byte-identical regenerated PDFs. Temperature zero does not establish determinism. The caller owns caching and idempotent publication; compare runs using source hashes, catalog contents, OCR languages, endpoint/model settings, dependency versions, and the code revision.

## Current method

1. OCRmyPDF/Tesseract adds a text layer, preserves existing text, and checks page count. No extracted text is not proof that a page is blank. Pages without text still reach image analysis. OCR errors remain failures.
2. One model request identifies document start pages and confirmed blank pages from all rendered images. Code excludes blank pages from the groups and checks complete source-page coverage. The adapter refuses to omit a page that has extracted text. Signatures, stamps, forms, photographs, and unreadable content must stay; uncertain pages require review. Model blank detection is not an accuracy guarantee.
3. One image-only request per group returns the recipient from the owner catalog, a short title, and the printed issue date. A due date or appointment date is not an issue date. Unmatched recipients use `unknown`.
4. A separate image-only request per document returns catalog tags, suggested new tags, and a summary.

Originals and the full searchable scan retain all pages. The saved proposal and filing history record omitted source pages. Review can restore them. Retained pages without OCR text still require review, so a model cannot hide missed OCR by simply accepting a document. An entirely blank scan always requires confirmation; approval creates no filed documents and keeps the original.

OCR remains separate because a transcript alone does not provide the word positions needed for selectable text aligned with the PDF. A future image OCR adapter must produce a correctly positioned text layer and pass accuracy checks before replacing local OCR. Blank-page detection shares the split request and adds no separate model call.

For six documents, this is normally 13 model requests: one split, six metadata requests, and six enrichment requests. Validation can cause up to two retries per request. The current splitter has no context windows. The eight public PDFs were evaluated with local Gemma 4. See [measured results](test-data/public-pdfs/results/README.md). Large batches can exceed the configured model context; the server reports request failures for retry.

## Usage and cost

Pass `record_usage: Callable[[ProcessingUsage], None]` to `EndpointInference` to receive one record per split, details, tagging, or review step, including failures. The record contains source pages, model, endpoint, elapsed seconds, reported input/cached/output tokens, request count, outcome, and a price snapshot. Validation retries are included. Tagging page numbers refer to the supplied document; the caller maps these to its source scan. The callback owns persistence. Recording failures are logged and do not stop parsing.

Set `InferenceSettings.pricing` with the matching model and endpoint, USD rates per million tokens, optional cached-input rate, source, and check date. Cached tokens are included in the total input count and charged once at their own rate. Missing usage, missing rates, or a different model/endpoint produces an unknown estimate. A failed step can contain a known partial cost; check `usage_complete` before treating it as a total. This estimate excludes unreported provider charges and is not an invoice.

All model stages, evals, and transcript generation use the shared 1600-pixel renderer. This does not resize stored PDFs or change OCR resolution.

## Prompts

Each prompt is a typed Python function in `paperman_parser/prompt/`:

- `split.py`: `split(pages: list[bytes]) -> Prompt` identifies document boundaries and blank pages.
- `details.py`: `details(pages: list[bytes], owners: list[CatalogEntry]) -> Prompt` extracts owner, title, and issue date.
- `enrich.py`: `enrich(pages: list[bytes], tags: list[CatalogEntry]) -> Prompt` assigns tags and a summary.
- `revise.py`: `revise(pages, catalog, proposal, instructions) -> Prompt` applies user feedback to the current proposal.

`Inference.revise(source, catalog, proposal, instructions) -> Analysis` returns a revised draft without saving state. It uses the whole scan's page images and validates page coverage, catalog owners, and blank-page omissions. The caller owns approval and filing. Demo inference does not support feedback.

Split confidence and detail confidence are combined using their minimum for each document. `review_reason` can explicitly ask for a decision about an uncertain boundary or field. A clearly absent recipient or issue date does not by itself imply uncertainty. Confidence is a model estimate, not a calibrated accuracy measure; the application owns review policy.

`Prompt` carries instructions, catalog/page context, and ordered PNG bytes. The
transport adds the images as image inputs, never as OCR text. These same functions
serve the application and benchmark runners. Existing benchmark results describe
the earlier text-only pipeline; they do not measure the image-only implementation.

## Checks

Install Poppler (`brew install poppler` or `apt-get install poppler-utils`) and
Tesseract before running the parser. The worker container includes both.

Run from the repository root:

```sh
uv sync --project packages/parser
uv run --directory packages/parser pytest
uv run --directory packages/parser basedpyright
uv run --directory packages/parser ruff check paperman_parser tests scripts
```

These checks run without the server, FastAPI, a data directory, or a live model. OCR tests need local Tesseract. Model transport tests replace only the external model boundary. They test contracts and failure handling, not model accuracy.

The eight public PDFs and label status are described in [test data](test-data/public-pdfs/README.md). All 18 page transcripts and 13 document labels were frozen before evaluation. Labels were written by the agent and have not had human review. The existing server integration script also checks fictional mixed mail against a configured live model.

The [real document eval set](test-data/real-scans/README.md) adds ten documents
with 15 pages from real invoices, forms, and receipts. Sources, file hashes,
frozen labels, and model results are saved. Source files stay in the local cache
because dataset rights differ.

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

Real-scan evals now compare local Gemma 4 with Luna and Sol on 10 real documents. See the [fixed dataset](test-data/real-scans/README.md) and [scores](test-data/real-scans/results/README.md). These image-only runs measure splitting and fields; they do not measure OCR or blank-page accuracy.
