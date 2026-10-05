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

No full transcript labels were created. **OCR accuracy and blank-page detection
were not measured.** No test page is blank. This set is now used for evaluation;
it must not be described as an unseen set after prompt changes use these results.

## Repeat an eval

Run from `packages/parser`. Use a new output directory for every run.

```sh
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/luna-new --model gpt-6-luna
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/sol-new --model gpt-6-sol
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/gemma-new --settings test-data/real-scans/gemma-settings.json
```

Omit `--source` for this image-only eval with no OCR score. Existing evals can
still pass `--source` to reuse checked OCR outputs. Text scores now aggregate all
labelled pages; the scorer no longer assumes that sample IDs identify scan types.
The saved historical text scores are unchanged.

The source archives and selected annotations are cached for inspection. Only
the manifest, PaperMan labels, settings, and derived results are intended for Git.
Source images, PDFs, upstream annotations, and model request images stay outside
Git. This is not a licence-cleared dataset bundle for distribution with PaperMan.
