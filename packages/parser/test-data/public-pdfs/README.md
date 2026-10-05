# Public PDF eval set

Eight unchanged PDFs, 18 pages, 1.07 MB. Downloaded on 2 October 2026.
The files are in [the local cache](../../../../.cache/public-pdfs/pdfs/).
[manifest.toml](manifest.toml) records source URLs, licences, attributions,
SHA-256 hashes, page counts, text-layer checks, and expected page groups.
The cache is ignored by Git; the manifest and this guide belong in Git.
Keep these basic checks, but use the new [real document candidates](../real-scans/README.md)
to prepare harder evals. Those files have not yet been scored.

## Contents

| ID                                               | Document                                | Pages | What it tests                                           |
| ------------------------------------------------ | --------------------------------------- | ----: | ------------------------------------------------------- |
| [01](../../../../.cache/public-pdfs/pdfs/01.pdf) | Vendor invoice                          |     2 | Invoice fields and continuation pages                   |
| [02](../../../../.cache/public-pdfs/pdfs/02.pdf) | Scanned purchase order                  |     1 | Image-only OCR, tables, delivery date versus issue date |
| [03](../../../../.cache/public-pdfs/pdfs/03.pdf) | Insurance claim packet                  |     9 | Six document groups, including two adjacent invoices    |
| [04](../../../../.cache/public-pdfs/pdfs/04.pdf) | Sample credit card statement            |     1 | Financial tables and an incomplete date                 |
| [05](../../../../.cache/public-pdfs/pdfs/05.pdf) | Mortgage statement guide                |     2 | Multiple columns and a sample statement inside a guide  |
| [06](../../../../.cache/public-pdfs/pdfs/06.pdf) | Wikipedia article from an Epson scanner |     1 | Dense scanned text and a contents box                   |
| [07](../../../../.cache/public-pdfs/pdfs/07.pdf) | Skewed equipment brochure               |     1 | Small text, bullets, columns, and deskewing             |
| [08](../../../../.cache/public-pdfs/pdfs/08.pdf) | French text with accents                |     1 | Accents, ligatures, and language selection              |

Files 02, 06, 07, and 08 have no extractable text. The other files contain
selectable text. All 18 pages rendered successfully. The page images and contact
sheets are in `.cache/public-pdfs/previews/`.

## Sources and rights

- **[DocJev](https://github.com/jerryjliu/docjev/tree/c7abe276a970605feb9cb8b27513365b6c10726e/datasets):** 01–03 are fictional examples, including a simulated scan. Content and labels are CC0; fonts and marks have separate rights. The upstream manifest supplies the split labels.
- **[CFPB](https://www.consumerfinance.gov/privacy/website-privacy-policy/#legal-notices):** 04–05 are official educational publications. CFPB-created content is public domain under its published policy; official marks retain protection.
- **[OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF/blob/3f5553cf19e5b10e714667a82a502c3b9c48d144/REUSE.toml):** 06–08 are OCR fixtures. Files 06 and 07 use CC BY-SA 3.0; 08 uses CC BY-SA 4.0. The manifest includes the upstream attributions. Preserve them when sharing files or derivatives.

GitHub URLs use fixed revisions. The source notices and the DocJev manifest are
also cached under `.cache/public-pdfs/source-notes/`. No PDF bytes were changed.
Neutral local filenames avoid giving the model a category through the filename.

## Use in the next test

Call the parser directly with the cached PDF bytes for parser evaluation. Use a
separate test storage directory for later server integration checks. Keep the
cache as the original source. Do not pass expected groups, labels, or this manifest to
the model. To restore a missing cache file, download its `source_url` to its
`file` name and check the recorded SHA-256 before use.

For file 03, the expected page groups are **1–2, 3, 4–5, 6–7, 8, 9**:
claim form, incident report, repair estimate, invoice, invoice, correspondence.
The two invoices must stay separate. The other seven PDFs each form one group.
These are source labels or inspection results, not PaperMan results.

Use test owner names from the documents only when testing a known-owner match.
With the current demo owner names, unfamiliar recipients should remain Unknown.
File 04 uses `XX` for the statement year; do not invent a full date from it.
File 05 is a guide, not a real mortgage bill. File 06 contains only one PDF page,
although its printed footer says “1 of 9”. File 08 needs French (`fra`) OCR data
for a fair Tesseract test.

This is a small test set, not a measure of production accuracy. It mixes public
samples, synthetic documents, and scan fixtures. It does not cover German mail,
handwriting, blank backs, photographs, or real household ownership. The PDFs were processed with local Gemma 4 on 4 October 2026. See
[the measured results](results/README.md).

## Ground truth and evaluation

All 18 page transcripts and 13 document labels were created by visually reading
rendered pages before the first model run. The agent wrote these labels; a human
has not reviewed them. `ground-truth.json` explains the evidence for each owner,
issue date, page group, and tag. `catalog.json` fixes the candidate owners and tags.
`ground-truth.sha256.json` freezes both files and every transcript.

Transcripts 06 and 07 are derivatives under CC BY-SA 3.0; transcript 08 is a
derivative under CC BY-SA 4.0. Their source attributions are in the manifest.
Transcripts 01–03 follow the source CC0 terms; 04–05 transcribe CFPB public-domain
content. Saved OCR and model output that quote these texts retain the applicable
source rights. Do not remove the source notices when sharing derivatives.

Run from the repository root, with a complete Tesseract data directory that has
`eng`, `fra`, `osd`, and the standard `configs` directory. Model settings are the
parser's `InferenceSettings` JSON, supplied explicitly. No expected labels or
transcripts are sent to the model. Only rendered PDF page images, stage instructions, page counts, and the catalog are sent. OCR text is saved for scoring and is never sent to the model.

```sh
TESSDATA_PREFIX=/path/to/tessdata uv run --project packages/parser python packages/parser/scripts/evaluate.py \
  --labels packages/parser/test-data/public-pdfs \
  --pdfs .cache/public-pdfs/pdfs \
  --settings /path/to/model-settings.json \
  --output .cache/public-pdfs/runs/new-run

uv run --directory packages/parser python -m scripts.score \
  --labels test-data/public-pdfs \
  --run ../../.cache/public-pdfs/runs/new-run
```

Each run has a new directory. The runner checks frozen label and source hashes,
saves each stage before proceeding, and retains failures. It saves searchable
PDFs, OCR text, predictions, stage times, dependency versions, model settings,
OCR language hashes, and source-code hashes. API keys are not saved.

### Codex model comparison

The saved 4–5 October baselines used text input. New runs use page images and must use a new output directory; do not overwrite the earlier results.

The user approved sending this public test set to OpenAI for a model comparison.
The application still uses its configured local model. The benchmark reuses the
source PDFs and the parser's image-only split, field, and tag prompts. Cached OCR is kept only for scoring. It sends
no expected labels or transcripts to the model and does not change the scorer.
OCR is not rerun, so this measures the model stages only.

```sh
uv run --directory packages/parser python -m scripts.benchmark_codex \
  --labels test-data/public-pdfs \
  --source test-data/public-pdfs/results/2026-10-04-instructions-v3 \
  --pdfs ../../.cache/public-pdfs/pdfs \
  --output ../../.cache/public-pdfs/runs/new-codex-run \
  --model gpt-6-luna
```

Use `gpt-6-sol` for the second model. Both use high reasoning effort. The runner
uses `codex exec` with the existing ChatGPT login and structured output. It does
not read or copy credentials. Each request starts in an empty temporary directory
with shell, web search, apps, hooks, and delegation disabled. Model tool use makes
the request fail. Saved prompts, PNG inputs and their hashes, schemas, responses, and events permit inspection
of the comparison. Codex controls temperature and adds its client context; this
is a Codex-based benchmark, not a direct API latency or price measurement.

Scoring keeps all eight PDFs and all 13 expected documents in the denominator.
Owner/date/title scores require an exact page-group match. The title score checks
predeclared keywords; it is not a measure of writing quality. Required/optional
tags are separate. OCR CER/WER count reading-order differences; word coverage
reports how much text was recovered regardless of order. No result is a claim
about unseen household mail or another model.
