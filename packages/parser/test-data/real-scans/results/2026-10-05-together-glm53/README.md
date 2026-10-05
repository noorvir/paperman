# Together GLM 5.3 Flash eval — 5 October 2026

**All measured labels matched at 1600 pixels.** The default 2400-pixel run failed
on the nine-page batch because Together rejected its internal multimodal payload.
Both runs are preserved. No privacy settings or application endpoint changed.

## Results

Ten real documents, 15 pages, in five eval inputs. Two batches contain seven
complete documents; three single-page excerpts count for field checks only.

| Check                          | Default 2400 px | Eval at 1600 px |
| ------------------------------ | --------------: | --------------: |
| Correct complete batches       |             1/2 |             2/2 |
| Exact complete-document groups |             3/7 |             7/7 |
| Correct split boundaries       |             2/5 |             5/5 |
| Extra boundaries               |               0 |               0 |
| Owner                          |            6/10 |           10/10 |
| Date                           |            6/10 |           10/10 |
| Title keyword rule             |            6/10 |           10/10 |
| Tag precision                  |             6/6 |           10/10 |
| Tag recall                     |            6/10 |           10/10 |
| Failed inputs                  |               1 |               0 |
| Sum of input processing times  |   155.4 seconds |   231.2 seconds |

Missing output remains in the score denominator. The first run's missing four
documents came from one rejected request, not incorrect model answers. The final
run matched the existing Sol scores. Luna previously missed one date. This is a
small, previously used research set; it does not establish production accuracy.
Title scoring checks fixed keywords. Optional tags are neutral. OCR, blank pages,
transcription, and searchable-PDF alignment were not evaluated.

## Request limit and resolution

Together returned HTTP 413, `multimodal_payload_too_large`, for the nine-page
split request: its internal payload was 487,880,352 bytes (465.3 MiB), above its
267,386,880-byte (255 MiB) gRPC ceiling. This was not the PNG upload size.
See the [saved provider error](2400/payload-error.json).

The second run used the eval runner's `--image-max-edge 1600` option for every
stage. It resizes each rendered PNG with Lanczos filtering, keeps the aspect
ratio, and records the images actually sent. It does not change source PDFs or
the application's 2400-pixel default. Larger batches can still exceed the limit.
The model passed this eval, but the default application configuration is not yet
ready for this endpoint's large-batch limit.

## Conditions and privacy

- Model: `zai-org/GLM-5.3-Flash` at `https://api.together.ai/v1`.
- Native JSON output, temperature 0, default reasoning, 8192 maximum output
  tokens, 180-second request timeout, and up to two validation retries.
- Production split, details, and enrichment prompts; rendered images only.
  No OCR text or answer labels were sent. Owners and tags use the frozen catalog.
- Both GLM runs used the same prompts. Compared with the earlier Gemma/Luna/Sol
  runs, current split/details instructions contain additional selective-review
  guidance. Resolution and reasoning settings also differ from those baselines;
  this is not a controlled model-only comparison.
- Requests succeeded without enabling third-party sharing. This establishes
  access under the current settings, not independent proof of every retention
  setting. Only public eval documents were submitted.
- The key came from 1Password through the process environment. No credential is
  stored in settings, results, or repository files.
- The live catalog lists $0.15 input and $0.50 output per million tokens, with
  $0.03 cached input. Token usage and billed cost were not recorded by this runner.

All frozen label, source PDF, parser, scorer, runner, and recorded image hashes
passed verification. The five prediction files validate against the eval schema.
Two scorer regression tests, strict types, and focused lint/format checks pass.

## Evidence and repeat command

This folder contains the final predictions, settings metadata, and scores.
[2400/](2400/) retains the first run. Full requests, responses, page images, and
runner snapshots stay outside Git in:

- `.cache/real-scans/runs/2026-10-05-together-glm53/`
- `.cache/real-scans/runs/2026-10-05-together-glm53-1600/`

From `packages/parser`, supply `PAPERMAN_MODEL_API_KEY` through the secret manager
and choose a new output directory:

```sh
uv run python -m scripts.benchmark_codex --labels test-data/real-scans --pdfs ../../.cache/real-scans/pdfs --output ../../.cache/real-scans/runs/glm-new --settings test-data/real-scans/together-glm-settings.json --image-max-edge 1600
```
