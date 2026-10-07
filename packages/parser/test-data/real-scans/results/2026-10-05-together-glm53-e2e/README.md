# GLM 5.3 Flash worker check — 5 October 2026

Ten documents, 15 pages, five input PDFs. All inputs completed OCR, filing, and tagging without review or retries.

| Check                          |                      Result |
| ------------------------------ | --------------------------: |
| Exact complete groups          |                         7/7 |
| Correct boundaries             |              5/5; no extras |
| Owners, dates, and title rules |                  10/10 each |
| Required tags                  | 10/10; no extra scored tags |
| Failed inputs / model calls    |                       0 / 0 |

Three incomplete excerpts count for fields but not splitting. Labels were fixed before inference and have no independent human review. This small set does not establish general accuracy. OCR ran, but its text accuracy was not scored here.

## Estimated model cost

**$0.02477295 USD total; $0.002477295 per document.** Wall time: 221 seconds. All 25 model requests reported usage.

| Step    | Calls | Input tokens | Cached input | Output tokens | Estimated USD |
| ------- | ----: | -----------: | -----------: | ------------: | ------------: |
| OCR     |     5 |            0 |            0 |             0 |   $0.00000000 |
| Split   |     5 |       40,529 |          768 |         1,076 |   $0.00652519 |
| Details |    10 |       46,324 |        5,120 |         5,560 |   $0.00911420 |
| Tagging |    10 |       42,124 |        1,792 |         6,060 |   $0.00913356 |

Rates were $0.15 input, $0.03 cached input, and $0.50 output per million tokens, from [Together pricing](https://www.together.ai/pricing), checked 5 October 2026. Cached tokens are charged once. Estimates exclude hardware, storage, tax, and unreported charges; they are not invoice totals.

[costs.json](costs.json) contains document-level allocations. Shared scan costs are divided by retained page count. Metadata paths are relative to the eval workspace, not a machine's home directory.

## Verified workflow

The worker received PDFs in an isolated inbox, ran OCR, sent 1600-pixel images, filed ten documents, generated tags, and cleared completed inbox entries. Checks covered original hashes, PDF page counts, metadata, usage totals, API reads, reopened storage, and search-index entries.

Saved predictions and hashes are in this directory. Full source content and application data stay outside Git under `.cache/real-scans/runs/2026-10-05-together-glm53-e2e/workspace/`. See the [dataset guide](../../README.md) for source rights and the [parser guide](../../../../README.md#usage-records) for usage contracts.
