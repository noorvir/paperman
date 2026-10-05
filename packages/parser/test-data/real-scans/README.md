# Real document evals

Ten real inputs, 15 pages, selected on 5 October 2026. These add real scan defects
and business documents to the existing fictional and educational examples.
**Gemma 4, GPT-6 Luna, and GPT-6 Sol were scored on 5 October 2026.**
See the [results and error analysis](results/README.md).

[manifest.json](manifest.json) records sources, fixed revisions, file hashes,
source labels, rights, and selection reasons. Original files are in
[the local input cache](../../../../.cache/real-scans/inputs/).
Upstream labels are separate, in `.cache/real-scans/annotations/`. No blur,
noise, text, or layout changes were added. The six image inputs have lossless PDF
wrappers made with img2pdf (`nodate=True`). pypdf joins the original PDFs and
wrappers without rasterising the PDF pages. Prepared inputs are in
`.cache/real-scans/pdfs/`. The manifest retains its frozen discovery status.

## Selected inputs

| ID | Source | Input | Pages | Main difficulty |
| --- | --- | --- | ---: | --- |
| 01 | VRDU | Scanned invoice | 4 | Scan noise, small numbers, continuation pages |
| 02 | VRDU | Faint invoice | 1 | Low contrast, several companies and date roles |
| 03 | VRDU | Clean real invoice | 2 | Billing recipient differs from advertiser |
| 04 | VRDU | Advertising contract | 2 | Dense table, repeated headers, service dates |
| 05 | FUNSD | Fax cover sheet | 1 | Skew, punched holes, fax header |
| 06 | FUNSD | Signed order form | 1 | Handwriting, checkboxes, signature |
| 07 | FUNSD | Fax message | 1 | Handwritten note, signature, scan noise |
| 08 | Personal invoices | Crumpled receipt | 1 | Folds, faded print, perspective |
| 09 | Personal invoices | Credit note | 1 | Faded print, several totals and dates |
| 10 | Personal invoices | Torn receipt | 1 | Uneven edges, phone photograph |

## Sources and limits

- **[VRDU](https://github.com/google-research-datasets/vrdu):** real business PDFs
  from FCC PublicFiles. Its human annotations cover selected fields. Its OCR
  output is machine output, not a human transcript. The selected PDFs retain
  all their pages. The repository has no explicit dataset licence; an
  [upstream licence question](https://github.com/google-research-datasets/vrdu/issues/3)
  remains unanswered. Keep its PDFs and annotations outside Git.
- **[FUNSD](https://guillaumejaume.github.io/FUNSD/):** noisy scanned forms, with
  word text, boxes, and form relationships. The selected pages are excerpts;
  missing fax attachments are not supplied. They can test reading and metadata,
  but must not be treated as complete documents for split accuracy.
  [Terms](https://guillaumejaume.github.io/FUNSD/work/) restrict use to
  non-commercial research and education. Underlying image rights remain separate.
- **[Personal invoices and receipts](https://zenodo.org/records/7213544):** 190
  real documents owned by one of the authors. Credit: Francisco Cruz and Mauro
  Castelli, 2022, DOI 10.5281/zenodo.7213544. The deposit metadata specifies
  CC BY 4.0. The selected samples are Portuguese receipt photographs. Labels
  include seller, date, tax IDs, amounts, and reference, not full page transcripts.

This is a harder research set, not a representative sample of household mail.
It lacks modern German letters, utility bills, and bank statements. The old US
business forms and Portuguese shop receipts test different parts of the problem.
Public files can also have appeared in model training data.

[DocILE](https://docile.rossum.ai/) is the next candidate for broader real
business documents. Its 6,680 annotated documents are separate from its 100,000
synthetic documents. Access requires a research request. No request was submitted
and no gated data was downloaded. [RVL-CDIP](https://adamharley.com/rvl-cdip/)
offers more noisy letters and invoices, but its standard labels are page classes,
not full-document groups or PaperMan owner labels.

## Fixed labels and batches

[ground-truth.json](ground-truth.json) contains fields checked from page images
before inference. These are agent labels, without independent human review.
[catalog.json](catalog.json) contains a fixed list of recipients and sender
distractors. Customer tax IDs alone do not establish owner names. The labels,
catalog, manifest, and [page map](batches.json) have fixed SHA-256 hashes.

| Eval input | Original source IDs | Expected groups | Split score |
| --- | --- | --- | --- |
| 01 | 01, 02, 03, 04 | 1–4; 5; 6–7; 8–9 | Included |
| 02 | 08, 09, 10 | 1; 2; 3 | Included |
| 03 | 05 | 1 | Excerpt; excluded |
| 04 | 06 | 1 | Excerpt; excluded |
| 05 | 07 | 1 | Excerpt; excluded |

Each original appears once. The two batches are constructed inputs, not original
scanner batches. There are seven complete documents and five true boundaries.
All ten documents count for owner, date, title, and tag scores. Field scores
require the correct page group. Missing or failed output stays in the denominator.

The original field evals had no transcript labels. **A separate OCR eval now uses
the accepted references below.** Blank-page detection remains unmeasured; no
test page is blank. This set is now used for evaluation;
it must not be described as an unseen set after prompt changes use these results.

## Reviewed transcripts and OCR eval

The user reviewed the Sol transcripts and accepted the set on 5 October 2026.
All saved edits and written corrections were applied to 10 Markdown documents and
15 page-level plain-text references. The accepted dataset is local at
`.cache/real-scans/reviewed/2026-10-05/`. It includes the page map, all 22 review
decisions, correction records, source provenance, and a fixed hash manifest.
The original field labels and model scores are unchanged.

The production OCR pipeline ran on all 15 pages. It kept nine existing text layers
and added text to six image-only pages. All outputs have extractable text.
Character error rate is 21.4% on new OCR and 38.2% overall. See the
[OCR report](results/2026-10-05-ocr/README.md) for word scores and limitations.
These are user-accepted Sol drafts, not independent double transcriptions.
Known unreadable regions are recorded. Reading order and those regions affect the
full-page scores. The results do not measure text-layer position or layout accuracy.

## Original transcription run

Sol transcript drafts are stored locally under
`.cache/real-scans/transcripts/2026-10-05-sol/`. The folder contains one Markdown
file per source document, with page breaks, headings, tables, and form fields.
Per-page JSON records list uncertain readings. Full transcripts stay outside Git
under the source datasets' existing redistribution limits.

The original model drafts are preserved. Use the reviewed copy above for OCR
references. Plain text follows block order and table rows from left to right;
Markdown syntax and editorial illegibility markers are excluded from scoring.
The production OCR implementation and searchable PDF layer remain unchanged.

The typed prompt is `paperman_parser/prompt/transcribe.py`. Run from
`packages/parser` with a new output directory and explicit PDF inputs:

```sh
uv run python -m scripts.transcribe --model gpt-6-sol --output ../../.cache/real-scans/transcripts/new-run ../../.cache/real-scans/inputs/01.pdf
```

The runner uses the existing Codex login and sends one rendered page image per
request, without OCR text or expected labels. It records model, prompt, source,
and image hashes, raw responses, and errors. The Markdown preserves document
structure; it does not reproduce exact page coordinates or add a PDF text layer.

## Repeat an eval

Run from `packages/parser`. Use a new output directory for every run.

```sh
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/luna-new --model gpt-6-luna
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/sol-new --model gpt-6-sol
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/gemma-new --settings test-data/real-scans/gemma-settings.json
```

Compatible endpoints read their credential from `PAPERMAN_MODEL_API_KEY` in the
process environment. Supply hosted API keys through your secret manager; never
put them in a settings file or command argument. Saved run metadata excludes
the credential. Endpoints without authentication use the existing `local` default.

Use `--image-max-edge 800` with `--settings` to test an endpoint at a smaller
image size. This changes only the eval requests, preserves page aspect ratios,
and records the actual sent images and their hashes. The shared default is 1600 pixels.
Together GLM 5.3 Flash rejected the nine-page batch at the earlier 2400-pixel size because
its internal multimodal request exceeded the provider's 255 MiB limit.

The GLM settings include a dated price snapshot. Endpoint eval predictions now
include per-step usage and estimated USD costs. Earlier runs do not have these
records; their costs cannot be recovered from response text alone.

Omit `--source` for this image-only eval with no OCR score. Existing evals can
still pass `--source` to reuse checked OCR outputs. Text scores now aggregate all
labelled pages; the scorer no longer assumes that sample IDs identify scan types.
The saved historical text scores are unchanged.

The source archives and selected annotations are cached for inspection. Only
the manifest, PaperMan labels, settings, and derived results are intended for Git.
Source images, PDFs, upstream annotations, and model request images stay outside
Git. This is not a licence-cleared dataset bundle for distribution with PaperMan.
