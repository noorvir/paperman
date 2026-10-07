# GLM 5.3 Flash results — 5 October 2026

Ten documents, 15 pages, five inputs. The nine-page request exceeded the provider's payload limit at 2400 pixels. At 1600 pixels, all measured labels matched.

| Check                       | 2400 px | 1600 px |
| --------------------------- | ------: | ------: |
| Exact complete groups       |     3/7 |     7/7 |
| Correct boundaries          |     2/5 |     5/5 |
| Owners                      |    6/10 |   10/10 |
| Dates                       |    6/10 |   10/10 |
| Title keyword rule          |    6/10 |   10/10 |
| Tag precision               |     6/6 |   10/10 |
| Tag recall                  |    6/10 |   10/10 |
| Failed inputs               |       1 |       0 |
| Total input processing time | 155.4 s | 231.2 s |

Missing output remains in the denominator. The rejected request accounts for four missing documents in the first run. Neither run added an extra boundary.

## Configuration and limits

Model: `zai-org/GLM-5.3-Flash` through Together. Native JSON, temperature 0, default reasoning, 8192 maximum output tokens, 180-second timeout, and up to two validation retries. Requests used page images and frozen catalogs. Credentials were supplied through `PAPERMAN_MODEL_API_KEY`.

The [2400-pixel error](2400/payload-error.json) was HTTP 413, `multimodal_payload_too_large`: the provider's internal payload exceeded its 255 MiB limit. The second run reduced the image edge to 1600 pixels. Larger batches can still exceed provider limits. The parser now uses 1600 pixels by default.

Both runs used identical prompts. Earlier Gemma/Luna/Sol runs used different review guidance and image settings, so this is not a controlled model-only comparison. This known set has no blank pages; OCR quality and text alignment were not scored. Token costs were not recorded in these runs; the [later worker check](../2026-10-05-together-glm53-e2e/README.md) includes costs.

## Evidence

This directory contains the 1600-pixel predictions and scores. [2400/](2400/) retains the first run. Full request images and responses stay outside Git under `.cache/real-scans/runs/`.

Use the [dataset command](../../README.md#run) with [GLM settings](../../together-glm-settings.json) and a new output directory to repeat the check.
