# Public PDF eval set

Eight PDFs, 18 pages, and 13 expected documents. [manifest.toml](manifest.toml) records download URLs, fixed revisions, licences, hashes, and page counts. Source PDFs stay outside Git in `.cache/public-pdfs/pdfs/`.

| ID  | Input                        | Pages | Main check                              |
| --- | ---------------------------- | ----: | --------------------------------------- |
| 01  | Fictional invoice            |     2 | Continuation pages                      |
| 02  | Scanned purchase order       |     1 | Tables and date roles                   |
| 03  | Fictional claim packet       |     9 | Six groups, including adjacent invoices |
| 04  | Sample credit card statement |     1 | Incomplete date                         |
| 05  | Mortgage statement guide     |     2 | Examples within reference material      |
| 06  | Scanned Wikipedia article    |     1 | Dense text                              |
| 07  | Skewed equipment brochure    |     1 | Columns and small print                 |
| 08  | French text                  |     1 | Accents and language selection          |

## Sources and rights

- **[DocJev](https://github.com/jerryjliu/docjev/tree/c7abe276a970605feb9cb8b27513365b6c10726e/datasets), 01–03:** fictional content and labels under CC0. Fonts and marks have separate rights.
- **[CFPB](https://www.consumerfinance.gov/privacy/website-privacy-policy/#legal-notices), 04–05:** educational publications. CFPB-created content is public domain; official marks retain protection.
- **[OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF/blob/3f5553cf19e5b10e714667a82a502c3b9c48d144/REUSE.toml), 06–08:** OCR fixtures. Files 06–07 use CC BY-SA 3.0; 08 uses CC BY-SA 4.0. Attributions are in the manifest.

These terms also apply to transcripts and quoted source text in saved results. Preserve the source notices when sharing derivatives.

## Labels

`ground-truth.json` records page groups, owners, issue dates, title keywords, and tags. `catalog.json` supplies candidate owners and tags. `ground-truth.sha256.json` freezes both files and the page transcripts. Labels were written by an agent from rendered pages before evaluation; they have not had independent human review.

Sample 03 has groups **1–2, 3, 4–5, 6–7, 8, 9**. Each other PDF forms one group. Sample 04 has no complete issue date; sample 05 is a guide, not a bill. This small set does not measure accuracy on unseen documents or blank-page detection.

## Run

Download each manifest `source_url` to `<cache_directory>/<file>` under the repository root and verify its SHA-256. Install Tesseract data for `eng`, `fra`, and `osd`, including the standard `configs` directory. Supply your own `InferenceSettings` JSON and endpoint credential through `PAPERMAN_MODEL_API_KEY` when needed.

From the repository root:

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

Use a new output directory for each run. The runner verifies source and label hashes and saves predictions, errors, timings, and settings. Model requests contain page images and catalogs, not answer labels or reference transcripts.

For a Codex comparison without rerunning OCR:

```sh
uv run --directory packages/parser python -m scripts.benchmark_codex \
  --labels test-data/public-pdfs \
  --source test-data/public-pdfs/results/2026-10-04-instructions-v3 \
  --pdfs ../../.cache/public-pdfs/pdfs \
  --output ../../.cache/public-pdfs/runs/new-codex-run \
  --model gpt-6-luna
```

The Codex CLI handles authentication. Tools are disabled for model requests. Cached OCR is used only for scoring. Timing includes client overhead. `source_run` records the source directory name; `source_sha256` identifies its files.

See [results](results/README.md) and the [scanned-document set](../real-scans/README.md).
