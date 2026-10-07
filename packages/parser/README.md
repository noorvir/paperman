# PaperMan parser

A Python package for OCR, document splitting, field extraction, and tagging. The caller supplies PDF bytes, a catalog, and the OCR and inference implementations. The parser does not read application storage or save results.

## Use

```python
from paperman_parser import parse
from paperman_parser.inference import EndpointInference
from paperman_parser.ocr import LocalOCR

inference = EndpointInference(settings, api_key)
result = await parse(pdf_bytes, catalog=catalog, ocr=LocalOCR(), inference=inference)

enrichment = await inference.enrich(document_pdf_bytes, catalog)
```

`settings` is an `InferenceSettings`; `catalog` is a `Catalog`, both from `paperman_parser.models`. The result contains a searchable PDF, ordered page text, document proposals, and confirmed blank pages.

## Interfaces

```text
OCR.searchable(pdf, languages, rotations=page_rotations) -> SearchableDocument(pdf, pages)
Inference.analyze(pdf, catalog) -> Analysis(documents, blank_pages, page_rotations)
Inference.revise(pdf, catalog, proposal, instructions) -> Analysis
Inference.enrich(pdf, catalog) -> Enrichment
```

- **OCR** applies the model's clockwise page corrections before its single OCR run. It must retain the source page count and provide a positioned text layer. `LocalOCR` uses OCRmyPDF/Tesseract and removes its temporary files after each call. Passing an explicit rotation list, including an empty one, disables Tesseract's separate orientation decision.
- **Inference** returns page groups and fields, or tags and a summary. `EndpointInference` accepts explicit settings and credentials. It sends rendered page images to a compatible endpoint. `DemoInference` provides fixed sample responses without network requests.
- **The caller** owns intake, checkpoints, review, date fallbacks, filenames, and publication. Analysis reads original page images first. The split call reports orientation; detail calls receive upright images. OCR follows analysis. A server can save progress between these stages without repeating model requests.

Each source page must appear exactly once in a document group or the blank-page list. Page numbers start at one. Originals retain every page; final documents can omit confirmed blanks. Missing issue dates stay absent in parser output.

`page_rotations` contains `{page, clockwise}` records for pages needing a 90°, 180°, or 270° correction relative to the original input. Proposals use a nonempty `owner_ids` list. Joint recipients can share a document; `unknown` is used alone. Existing records with `owner_id` remain readable. Titles retain recognizable organization names and specific subjects.

Document proposals include confidence and an optional review reason. An uncertain split or field can request review. Confidence is a model estimate; the application chooses the review policy. `revise` applies plain-English instructions to a draft and validates the result. The caller must approve and save it.

## Model requirements

The endpoint must support multiple images and structured output. Shared prompt functions in `paperman_parser/prompt/` cover splitting, details, enrichment, and review. Poppler renders page images with a 1600-pixel longest edge. OCR text stays available for search and is not sent as model input.

A batch with N documents normally needs 1 split request, N detail requests, and N enrichment requests. Schema validation allows up to two retries per request. Large batches can exceed a provider's context or payload limit.

## Usage records

An optional `record_usage` callback receives `ProcessingUsage` for each model step, including failures and retries. It records source pages, model, endpoint, elapsed time, token counts, and an optional cost estimate. The caller stores these records and maps document pages back to source pages. Callback failures are logged without stopping parsing.

`InferenceSettings.pricing` supplies rates for a specific model and endpoint. Missing rates or usage leave cost unknown. Cached tokens are charged once at their rate; `usage_complete` distinguishes a total from a partial estimate.

## Checks

Install Poppler, Tesseract, and the required language data. From the repository root:

```sh
uv sync --project packages/parser
uv run --directory packages/parser pytest
uv run --directory packages/parser basedpyright
uv run --directory packages/parser ruff check paperman_parser tests scripts
```

Tests require no running server or model. Model accuracy is measured separately with the [public PDF set](test-data/public-pdfs/README.md) and [scanned-document set](test-data/real-scans/README.md).
