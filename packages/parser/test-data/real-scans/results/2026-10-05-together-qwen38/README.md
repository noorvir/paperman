# Qwen3.8 Flash connection check — 5 October 2026

Together returned HTTP 403, `third_party_data_sharing_blocked`, before inference for `Qwen/Qwen3.8-Flash`. The model requires third-party sharing. No accuracy score or measured cost exists for this attempt.

The request used one public FUNSD page, the parser's split prompt, and native JSON output. Image and structured-output support remain unverified because the request was rejected before processing.

[Settings](../../together-settings.json) record the attempted configuration. Credentials are supplied separately through `PAPERMAN_MODEL_API_KEY`. This attempt is separate from the [scored model runs](../README.md).
