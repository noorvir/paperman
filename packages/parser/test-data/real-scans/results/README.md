# Scanned-document results

Ten documents, 15 pages, five inputs. Seven complete documents count for splitting; three excerpts count only for fields. Labels were fixed before inference and have no independent human review.

## Image-input model checks — 5 October 2026

| Check                 | Gemma 4 E2B Q8_0 | GPT-6 Luna | GPT-6 Sol |
| --------------------- | ---------------: | ---------: | --------: |
| Exact complete groups |              0/7 |        7/7 |       7/7 |
| Correct boundaries    |              0/5 |        5/5 |       5/5 |
| Extra boundaries      |                0 |          0 |         0 |
| Owners                |             3/10 |      10/10 |     10/10 |
| Dates                 |             2/10 |       9/10 |     10/10 |
| Title keyword rule    |             2/10 |      10/10 |     10/10 |
| Tag precision         |              3/5 |      10/10 |     10/10 |
| Tag recall            |             3/10 |      10/10 |     10/10 |
| Processing failures   |                0 |          0 |         0 |

Gemma merged each batch into one document and missed all five boundaries. Luna treated the signed form's creation date as unsuitable for an issue date and requested review. Sol matched every measured label. Field scores depend on correct grouping, so split errors also reduce field scores.

All three used identical page images, split prompts, schemas, and catalogs. Gemma used native JSON, no reasoning, and a 4,096-token context. Luna and Sol used high reasoning through Codex with tools disabled. Serial Gemma calls and concurrent Codex calls are not a controlled speed comparison. No OCR text or answer labels were sent.

Evidence: [Gemma](2026-10-05-gemma/), [Luna](2026-10-05-luna/), [Sol](2026-10-05-sol/). Local endpoint addresses in published records use `http://model.example/v1`; model IDs, scores, and source hashes are unchanged.

## Other checks

| Check                                                                | Result                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [GLM 5.3 Flash](2026-10-05-together-glm53/README.md)                 | Matched all measured labels at 1600 pixels; the 2400-pixel batch hit a provider payload limit. |
| [GLM full worker and costs](2026-10-05-together-glm53-e2e/README.md) | All ten documents filed and tagged; estimated model cost $0.02477295.                          |
| [Qwen3.8 Flash](2026-10-05-together-qwen38/README.md)                | Provider rejected the request before inference; no accuracy score.                             |
| [OCR](2026-10-05-ocr/README.md)                                      | Character error rate 21.4% for new OCR and 38.2% overall.                                      |

GLM used later review prompts, so these are not model-only comparisons. The set has no blank pages. Small, known public datasets cannot establish general accuracy. Source rights and preparation instructions are in the [dataset guide](../README.md).
