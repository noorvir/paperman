# Public PDF eval results

Eight PDFs, 18 pages, 13 logical documents. The agent read every page image and
saved the labels before the first model run. There was no human label review.
Jev was not used. The 4 October runs used the local Llama app. On 5 October,
the user approved an OpenAI comparison using this public test set.

## Image input eval on 5 October 2026

Reran all eight PDFs with `gpt-6-luna`, high reasoning effort, and the current
image-only stage prompts. This includes the blank-page output contract. The
18 source pages, catalog, frozen labels, and scorer were unchanged. OCR was
reused for scoring and was not sent to the model or rerun.

| Measure | Result |
| --- | ---: |
| Exact PDF grouping | 8/8 |
| Exact document groups | 13/13 |
| Correct owner and group | 13/13 |
| Correct issue date or absence and group | 13/13 |
| Title keyword check and group | 12/13 |
| Tag precision | 18/19 (94.7%) |
| Required tag recall | 18/18 (100%) |
| Processing failures | 0/8 |

All five split boundaries were correct. The image input recovered the issue-date
distinction in sample 02. The extra tag is still `claim` on the claim letter;
the existing reference excludes it. Sample 08 was titled "Literary text excerpt",
which misses the frozen French/pangram/sample keyword rule. The labels were not
changed to improve the score. No page in this set was marked blank; the separate
blank-page checks do not increase this set's size.

This is one run on a small, known set with agent-written labels and no human
label review. It does not establish accuracy on real incoming mail. The current
local model and Sol were not rerun in this image eval. Application model settings
were not changed.

Predictions, scores, and input/source hashes are in
`2026-10-05-luna-images-eval/`. The exact prompts, page images, responses, and
client events remain in `.cache/public-pdfs/runs/2026-10-05-luna-images-eval/`.
Source rights in the parent guide also apply to reproduced text in these records.
The next candidate set is [real scanned documents](../../real-scans/README.md).

## Text input comparison on 5 October 2026

Luna ran first. Its scores were below 100%, so Sol ran next, as requested.
Both used the existing Codex ChatGPT login, with no API key read or copied.
The runner uses the supported [Codex non-interactive client](https://learn.chatgpt.com/docs/non-interactive-mode)
and structured output. Application model settings were not changed.

| Measure                              | Gemma 4, revised instructions |    GPT-6 Luna |     GPT-6 Sol |
| ------------------------------------ | ----------------------------: | ------------: | ------------: |
| Exact document groups                |                  13/13 (100%) |  13/13 (100%) |  13/13 (100%) |
| Correct owner and group              |                 10/13 (76.9%) |  13/13 (100%) | 12/13 (92.3%) |
| Correct issue date/absence and group |                 10/13 (76.9%) | 12/13 (92.3%) | 12/13 (92.3%) |
| Title keyword check and group        |                 12/13 (92.3%) |  13/13 (100%) |  13/13 (100%) |
| Tag precision                        |                 15/21 (71.4%) | 18/19 (94.7%) | 17/20 (85.0%) |
| Required tag recall                  |                 15/18 (83.3%) |  18/18 (100%) | 17/18 (94.4%) |
| Processing failures                  |                           0/8 |           0/8 |           0/8 |

Both OpenAI models found all eight packet groupings and all five boundaries.
Luna performed better than Sol in this run; neither achieved 100% across the
scored fields. This is one run per model on eight known PDFs, with agent-written
labels that have no human review. It is not evidence of perfect unseen-mail
accuracy or a general ranking of these models.

### Controlled inputs and settings

- Exact model IDs: `gpt-6-luna` and `gpt-6-sol`, both at high reasoning effort.
- Same 18 OCR page texts, catalog, production stage prompts, schemas, and scorer.
  The inference source hash matches the 4 October revised Gemma run.
- Frozen label and transcript hashes still match. The models received no answer
  labels, transcripts, previous predictions, or scoring feedback.
- 34 requests per completed run: eight splits, 13 field extractions, and 13 tag
  extractions. No model tool calls or output-validation retries occurred.
- Each request used an empty temporary directory and disabled shell, web search,
  apps, hooks, host skill discovery, and delegation. Codex still adds client
  context and controls temperature. Gemma used temperature 0 and no reasoning;
  this compares complete configurations, not model weights alone.
- OCR was reused, not rerun. Its error rates are unchanged. Request durations
  include client startup and connection fallback, so they are not API latency
  or price measurements.

### Remaining disagreements

1. **Date, both models:** sample 02's image says “REQUESTED DELIVERY” above
   October 15. OCR lost that label. Both models selected the delivery date as the
   issue date. The fixed reference correctly expects no issue date.
2. **Extra tag, Luna:** sample 03 page 9 received `claim` as well as `insurance`
   and `correspondence`. The frozen reference rejects `claim`. A claim-related
   letter can reasonably fit that name: the catalog gives names, without rules
   that distinguish a claim form from all claim-related documents. This label
   needs human review. The reported score keeps the original rule unchanged.
3. **Owner and tags, Sol:** the fictional claim form was treated as reference
   material, with owner `unknown` instead of policyholder Parker Quinn. Sol also
   tagged the claim letter as `claim` and `reference`, and missed `correspondence`.
   These examples carry visible synthetic/demo notices. Their expected use as
   ordinary document types needs to be clear in future benchmark rules.

A separate diagnostic supplied Luna with sample 02's rendered page image,
alongside the same OCR text and field prompt. It returned `document_date: null`
and correctly identified October 15 as requested delivery. This supports fixing
lost visual context before another model upgrade. The diagnostic is excluded
from the table above; it is not an eight-PDF vision benchmark.

Use Luna as the stronger baseline on this set. Next, preserve date-label context
through vision or improved OCR, define tag inclusion rules, review ambiguous
labels, and test new documents that were not used to tune the prompts.

### Saved evidence

`2026-10-05-codex-luna/` and `2026-10-05-codex-sol/` contain all eight predictions,
scores, settings/source hashes, and `requests.json` with each stage's exact
instructions, input, schema, response, usage, and client notices. Luna's
`vision-diagnostic.json` records the separate image check. The source licences
listed in the parent README apply to reproduced text in these files.

An initial Luna attempt stopped five samples when the runner mistook a successful
WebSocket-to-HTTPS fallback notice for a model tool call. That attempt remains in
`.cache/public-pdfs/runs/codex-gpt-6-luna-2026-10-05/`. After fixing the notice
check, a fresh complete run produced the Luna scores above. There was no selection
between successful runs based on accuracy. Raw client logs remain in the local
run cache; credentials were never read or included in those logs.

## Local model results — 4 October 2026

Model: `ggml-org/gemma-4-E2B-it-GGUF:Q8_0`, native JSON output, temperature 0,
reasoning disabled, 180-second request timeout. OCR used OCRmyPDF and Tesseract,
with English or French selected by the sample manifest.

| Measure                              | Original instructions | Revised instructions (v3) |
| ------------------------------------ | --------------------: | ------------------------: |
| Exact PDF grouping                   |           6/8 (75.0%) |                8/8 (100%) |
| Exact document groups                |          9/13 (69.2%) |              13/13 (100%) |
| Correct owner and group              |          7/13 (53.8%) |             10/13 (76.9%) |
| Correct issue date/absence and group |          4/13 (30.8%) |             10/13 (76.9%) |
| Title keyword check and group        |          8/13 (61.5%) |             12/13 (92.3%) |
| Boundary precision                   |           5/9 (55.6%) |                5/5 (100%) |
| Boundary recall                      |            5/5 (100%) |                5/5 (100%) |
| Tag precision                        |          8/34 (23.5%) |             15/21 (71.4%) |
| Required tag recall                  |          8/18 (44.4%) |             15/18 (83.3%) |
| Processing failures                  |                   0/8 |                       0/8 |

The revised instructions were written after inspecting baseline failures. This
is a comparison on a known test set, not a held-out accuracy estimate. The
original instructions often treated continuation pages as new documents. The
revised instructions explain continuation references, separate invoices,
educational examples, date roles, and document-purpose tags. The labels were
not changed between runs.

Remaining errors matter. The revised run assigned the invoice sender as owner
in sample 01. It treated people inside the educational examples in 04 and 05 as
owners. It used the delivery date in 02, incident date in 03, and example date
in 05 as issue dates. Tags still include incorrect or missing labels. Review
before filing stays enabled by default. Do not use these results to claim that
this small local model can file unseen mail without review.

Summaries are saved with predictions but have no numerical quality score.
Baseline summaries sometimes changed a date's meaning or a line item. Title
scores only check the frozen topic keywords, not title style or full accuracy.

## Text results

OCR and extraction were unchanged between the two runs.

| Input type           | Pages | Character error rate | Word error rate | Word coverage, ignoring order |
| -------------------- | ----: | -------------------: | --------------: | ----------------------------: |
| Existing text layers |    14 |               21.60% |          24.37% |                        99.37% |
| Image-only scans     |     4 |               22.98% |          34.62% |                        96.04% |

CER and WER compare the full page reading order. The reference uses paragraph,
table-row, and column order. Extracted text often uses a different order, which
accounts for much of the gap between error rates and word coverage. Coverage
ignores order and must not be presented as full OCR accuracy. These results do
not prove correct text positions, table structure, or every small printed value.
The set lacks German mail, handwriting, blank backs, and real household owners.

## Evidence and reproduction

- `2026-10-04-baseline/`: original model instructions, all predictions and scores.
- `2026-10-04-instructions-v3/`: revised instructions, all predictions and scores.
- Each `run.json` records settings, dependency versions, OCR language hashes,
  label hashes, and parser source hashes. The Git revision alone is insufficient:
  the parser changes were uncommitted during the runs.
- Searchable PDFs remain in the ignored local run cache. Original PDF hashes and
  download sources are in the test manifest. The run records keep the extracted
  page text used by the model.
- The initial attempt lacked Tesseract's standard `configs` folder. Its four
  image-only inputs failed before inference. That setup failure is retained in
  `.cache/public-pdfs/runs/baseline-2026-10-04`; it is not either measured run above.
- Reproduction commands and transcript rights are in the parent README. The
  source licences also apply to quoted text in these result records.

## Application checks

All eight PDFs also passed through the application upload API, real OCR and
local model, review, filing, enrichment, PDF download, metadata/text correction,
and search. Review applied the frozen labels before filing: 13 documents from
18 source pages. This proves the reviewed workflow, not perfect AI accuracy.
Repeat tagging preserved manual corrections. Duplicate upload kept the scan and
document counts unchanged. Reopening storage and rebuilding the index retained
all 13 documents.

A separate live-worker check used fictional mail. An unreachable model endpoint
produced a visible failure and kept the original and OCR output. The worker was
terminated during a retried analysis. A new worker resumed the saved stage and
reached review, filing, and enrichment. A tagging outage was also visible and
recovered after retry. A filesystem backup copy restored originals, filed PDFs,
and a rebuilt search index. The first recovery-check attempt stopped on its
heartbeat assertion; the resumed check waited for the live heartbeat and passed.

Page-group correction has a regression test for interrupted publication. Old
documents stay visible until all replacement groups are ready. Retry completes
the revision, unchanged groups retain IDs and manual changes, and replaced files
are archived. The browser check covered invalid page ranges, merging, saved
results, Cancel, and desktop/phone layouts. A further test requires review when
a page has no readable text, even with confident AI and automatic filing enabled.

Evidence summaries are in `2026-10-04-application/`. Detailed local application
records and logs are in `.cache/public-pdfs/application-2026-10-04/` and
`.cache/public-pdfs/recovery-2026-10-04/`. The opt-in mixed-mail model check also
passed again with the current instructions. Printer-to-Pi delivery and polling
on that live destination remain to be connected.
