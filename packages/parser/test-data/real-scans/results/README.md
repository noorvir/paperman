# Real-scan eval results — 5 October 2026

The [full worker GLM eval with costs](2026-10-05-together-glm53-e2e/README.md)
passed all measured labels at the new shared 1600-pixel default. It processed
10 documents in 221 seconds, with an estimated model charge of $0.02477295.
Each document has a cost breakdown in its TOML metadata and the Details tab.
Original hashes, OCR output, filing, tagging, API results, restart, and indexing
were checked in isolated public test storage.

A later [OCR eval](2026-10-05-ocr/README.md) uses the user-accepted transcripts.
The model results below are unchanged.

The [Together Qwen3.8 Flash connection check](2026-10-05-together-qwen38/README.md)
was blocked by the provider's third-party-sharing requirement. It has no model
accuracy score and did not change the application endpoint.

The later [Together GLM 5.3 Flash eval](2026-10-05-together-glm53/README.md)
matched 7/7 complete groups and 10/10 owners, dates, title rules, and required
tags at 1600 pixels. The default 2400-pixel run exceeded Together's internal
payload limit on the nine-page batch. Current review prompts differ from the
earlier runs below. No privacy setting or application endpoint changed.

Ten real documents, 15 pages. Two constructed batches contain seven complete
documents. Three single-page excerpts count for field checks only. Labels were
checked visually and frozen before inference. They have no independent human
review. All three models used the current production prompts and rendered page
images, with the same owner and tag catalogs. No OCR text was sent.

## Scores

| Check | Local Gemma 4 E2B Q8_0 | GPT-6 Luna | GPT-6 Sol |
| --- | ---: | ---: | ---: |
| Correct complete batches | 0/2 | 2/2 | 2/2 |
| Exact complete-document groups | 0/7 | 7/7 | 7/7 |
| Correct split boundaries | 0/5 | 5/5 | 5/5 |
| Extra boundaries | 0 | 0 | 0 |
| Owner | 3/10 | 10/10 | 10/10 |
| Date | 2/10 | 9/10 | 10/10 |
| Title keyword rule | 2/10 | 10/10 | 10/10 |
| Tag precision | 3/5 (60%) | 10/10 (100%) | 10/10 (100%) |
| Tag recall | 3/10 (30%) | 10/10 (100%) | 10/10 (100%) |
| Request/processing failures | 0 | 0 | 0 |

Field and tag scores require the correct page group. Thus a split error also
reduces the field scores. These are pipeline scores, not a separate measure of
field extraction on pre-split documents. Optional tags are neutral. Title scoring
checks fixed keywords; it does not prove that every title is ideal.

## Errors

- **Gemma:** treated all nine pages of the invoice/contract batch as one invoice.
  It also treated the three separate receipts as one invoice. It missed all five
  boundaries, so none of those seven documents qualified for later field scores.
  It found the right owners on all three standalone excerpts. On the signed form,
  it returned `2021-06-21` instead of `2000-01-21`. One fax title failed the title
  rule. Its merged invoice result had an invented 2024 date and confidence 0.95.
- **Luna:** returned no date for the signed form. It explicitly said the visible
  “Date Initiated” was not an issue date. The frozen rule uses that form creation
  date, `2000-01-21`. This is a date-policy distinction, not unreadable text.
  The model flagged the uncertainty for review.
- **Sol:** matched every measured label in this run, including that form date.

Sol is the strongest measured reference on this set. Luna is close. The current
local Gemma setup is not suitable for unattended mixed-batch splitting on these
inputs. This run does not identify whether a larger local model, a different
image setting, or a different split strategy would fix it.

## Conditions and evidence

- Gemma used the existing Llama app at `127.0.0.1:9931`, with image support,
  native structured output, reasoning disabled, and its existing 4,096-token
  context. Server logs show no truncation for these requests. No timeout or
  context-limit failure occurred. No local model settings were changed.
- Luna and Sol used the existing Codex ChatGPT login, high reasoning, structured
  output, no tools, and no repository access. No API key was copied or used.
- The three transports used byte-identical split prompts, schemas, and page
  images. PDF, parser-source, scorer, and frozen-label hashes were verified after
  completion. Prompts and labels were not tuned between models.
- Gemma processed inputs serially; Codex processed up to four at a time. Total
  sample times sum to about 102, 396, and 482 seconds for Gemma, Luna, and Sol.
  These are not equal-work speed comparisons: Gemma made fewer calls because it
  failed to split. Detailed stage times are in each prediction file.
- Saved predictions, settings, source hashes, and scores: [Gemma](2026-10-05-gemma/),
  [Luna](2026-10-05-luna/), [Sol](2026-10-05-sol/).
- Full requests, page images, model responses, and runner snapshots are local at
  `.cache/real-scans/runs/2026-10-05-{gemma,luna,sol}/`. They remain outside Git.

The run uses public US business forms and Portuguese receipts. It does not prove
accuracy on household mail or modern German documents. Public pages can have
appeared in model training data. One run on ten documents cannot establish 100%
production accuracy. OCR text accuracy, searchable-PDF quality, blank-page
detection, scanner delivery, and filing were not evaluated here.
