# GLM 5.3 Flash: full worker eval and costs

5 October 2026. **10 documents, 15 pages, 5 input PDFs. All scored field and split labels matched.** The real-scan set contains noisy invoices, fax/form excerpts, and receipt photos. All inputs completed without review or retries.

## Results

| Check                          | Result                       |
| ------------------------------ | ---------------------------- |
| Exact complete batches         | 2/2                          |
| Exact complete document groups | 7/7                          |
| Boundaries                     | 5 correct; 0 extra or missed |
| Owners                         | 10/10                        |
| Issue dates                    | 10/10                        |
| Title keyword rule             | 10/10                        |
| Required tags                  | 10/10; 0 extra scored tags   |
| Failed inputs / model calls    | 0 / 0                        |

Three incomplete fax/form excerpts are included in field scores, but excluded from complete-document split scores. Labels were checked by an agent and frozen before these runs. This is a small set, not evidence of universal accuracy. OCR ran, but CER/WER were not scored in this run; the separate reviewed OCR evaluation is unchanged.

## Estimated model cost

**Total: $0.02477295 USD (2.48 cents). Mean: $0.002477295 per document.** Wall time: 221 seconds. Model steps: 25 requests, all with usage reported. Local OCR: 5 steps.

Rates: $0.15 per million input tokens, $0.03 cached input, $0.50 output. Source: [Together pricing](https://www.together.ai/pricing), checked 5 October 2026. Cached input is part of the input total and is charged only once. Estimates exclude hardware, storage, tax, and any unreported provider charges. These are not provider invoice totals.

| Step    | Calls | Input tokens | Cached input | Output tokens | Estimated USD |
| ------- | ----: | -----------: | -----------: | ------------: | ------------: |
| ocr     |     5 |            0 |            0 |             0 |   $0.00000000 |
| split   |     5 |       40,529 |          768 |         1,076 |   $0.00652519 |
| details |    10 |       46,324 |        5,120 |         5,560 |   $0.00911420 |
| tagging |    10 |       42,124 |        1,792 |         6,060 |   $0.00913356 |

### Each document

| Input / pages | Document                                        |   Split USD |  Fields USD |    Tags USD |   Total USD |
| ------------- | ----------------------------------------------- | ----------: | ----------: | ----------: | ----------: |
| 01 / 1,2,3,4  | Television advertising invoice                  | $0.00166304 | $0.00198295 | $0.00195273 | $0.00559872 |
| 01 / 5        | Television advertising invoice                  | $0.00041576 | $0.00061455 | $0.00066105 | $0.00169136 |
| 01 / 6,7      | Television advertising invoice                  | $0.00083152 | $0.00094955 | $0.00106835 | $0.00284942 |
| 01 / 8,9      | Television advertising contract                 | $0.00083152 | $0.00108355 | $0.00118885 | $0.00310392 |
| 02 / 1        | Hair salon receipt                              | $0.00044245 | $0.00070385 | $0.00087343 | $0.00201973 |
| 02 / 2        | Zara Home credit note                           | $0.00044245 | $0.00065785 | $0.00071493 | $0.00181523 |
| 02 / 3        | Flying Tiger purchase receipt                   | $0.00044245 | $0.00115435 | $0.00068193 | $0.00227873 |
| 03 / 1        | Confidential facsimile transmission cover sheet | $0.00049053 | $0.00072005 | $0.00057513 | $0.00178571 |
| 04 / 1        | Direct mail coupon initiation form              | $0.00048443 | $0.00068245 | $0.00082253 | $0.00198941 |
| 05 / 1        | Fax cover page                                  | $0.00048103 | $0.00056505 | $0.00059463 | $0.00164071 |

Shared split and OCR costs are divided by retained page count. OCR has no model API charge. Unrounded decimal allocations are stored in metadata; display rounding can cause a small difference when adding table cells.

## End-to-end checks

The actual server worker detected each PDF in an isolated inbox, ran OCR, sent 1600-pixel page images to GLM, split and filed PDFs, generated tags, and removed completed inbox entries. The fixed catalog was supplied. No field labels or OCR text were sent to the model.

Checks passed: preserved original hashes; searchable PDF page counts; ten document TOML files; per-step usage/costs; shared-cost totals; document API round trips; reopened filesystem storage; ten search-index entries; empty inbox. Frozen labels and older results remain unchanged.

Full PDFs, OCR text, and application data remain outside Git in `.cache/real-scans/runs/2026-10-05-together-glm53-e2e/workspace/`. The adjacent `costs.json` links to each local sidecar. Saved predictions omit full OCR text. The cache contains the runner and complete outputs. Household documents and live model/privacy settings were not changed.

The renderer is now 1600 pixels for all model stages and transcript generation. Stored PDFs and OCR resolution are unchanged. Cost collection is injected into the parser; the application saves scan records and document shares. Missing usage or rates remain unknown.

Validation: 23 parser tests and 34 server tests passed; strict Python/web types and the web production build passed. The new Details cost table uses the shared table components; it was not visually inspected in this turn.
