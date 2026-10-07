# Public PDF results

Eight PDFs, 18 pages, 13 expected documents. Labels were fixed before evaluation and have no independent human review. Field scores require a correct page group. Title scores check keywords; tag scores distinguish required and optional tags.

## Model scores

| Run                                          | Input       | Exact groups | Owners | Dates | Title rule | Tag precision | Tag recall |
| -------------------------------------------- | ----------- | -----------: | -----: | ----: | ---------: | ------------: | ---------: |
| [Gemma baseline](2026-10-04-baseline/)       | OCR text    |         9/13 |   7/13 |  4/13 |       8/13 |          8/34 |       8/18 |
| [Gemma revised](2026-10-04-instructions-v3/) | OCR text    |        13/13 |  10/13 | 10/13 |      12/13 |         15/21 |      15/18 |
| [Luna](2026-10-05-codex-luna/)               | OCR text    |        13/13 |  13/13 | 12/13 |      13/13 |         18/19 |      18/18 |
| [Sol](2026-10-05-codex-sol/)                 | OCR text    |        13/13 |  12/13 | 12/13 |      13/13 |         17/20 |      17/18 |
| [Luna images](2026-10-05-luna-images-eval/)  | Page images |        13/13 |  13/13 | 13/13 |      12/13 |         18/19 |      18/18 |

All five runs completed without processing failures. The Gemma revision followed inspection of baseline errors, so it is not a test on unseen data. Luna and Sol used high reasoning through the Codex CLI; Gemma used native JSON, temperature 0, and no reasoning. These compare complete configurations, not model weights alone.

Main errors:

- OCR omitted the delivery-date label in sample 02. Both text-input OpenAI runs used that date as the issue date; the image run corrected it.
- Gemma confused senders or people in educational examples with owners.
- Luna added `claim` to a letter whose fixed tag rule excludes it. Sol treated a fictional claim as reference material. These label distinctions need review.
- The image run missed sample 08's title keyword rule. Summaries have no numerical quality score.

## OCR

| Input         | Pages | Character error rate | Word error rate | Word coverage |
| ------------- | ----: | -------------------: | --------------: | ------------: |
| Existing text |    14 |               21.60% |          24.37% |        99.37% |
| New OCR       |     4 |               22.98% |          34.62% |        96.04% |

Error rates include reading-order differences. Coverage ignores order. Neither measures text-layer alignment. OCR output was reused for model comparisons; the set has no blank pages.

## Application checks

The [application records](2026-10-04-application/) cover upload, OCR, review, filing, tagging, edits, duplicates, restart recovery, and a file-copy restore. Review applied the fixed labels before filing 13 documents. These checks verify the reviewed workflow, not automatic model accuracy.

## Evidence

Each run retains predictions, scores, settings, and source hashes. Codex text runs also include request records. Full PDFs and request images are kept outside Git under `.cache/public-pdfs/`. Earlier failed setup attempts are excluded from the scored runs.

Local endpoint addresses in published records use `http://model.example/v1`. Source-run references use directory names. These replacements remove machine details; model IDs, predictions, scores, and source hashes are unchanged.

See the [dataset guide](../README.md) for commands and source licences. Results from this small, known set do not establish general accuracy.
