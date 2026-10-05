# Together Qwen3.8 Flash connection check

Status: **blocked before inference** on 5 October 2026. No accuracy score exists.

- The API key authenticated successfully. The model list includes
  `Qwen/Qwen3.8-Flash`.
- The production parser attempted its image-only split request on eval input
  `03.pdf`: one public FUNSD fax page. The request used native JSON output and
  the same split prompt as the existing evals.
- Together returned HTTP 403 with code `third_party_data_sharing_blocked`:
  "This model requires third-party data sharing to be enabled for your organization."
- The request failed before splitting, field extraction, or tagging. Image and
  structured-output support were not verified by this check. No full eval ran.
- Third-party sharing was not enabled. The application model was not changed.
  This response establishes that third-party sharing is blocked; it does not
  independently confirm every organization retention setting.

The key was read from 1Password and supplied through `PAPERMAN_MODEL_API_KEY`.
No credential is stored in settings, results, or repository files. No private
PaperMan documents were submitted.

The live model catalog reports input/output prices of $0.15/$0.47 per million
tokens. The public model page showed $0.09/$0.28 on the same day. Neither figure
is a measured charge for this rejected request.

[Settings](../../together-settings.json) preserve the attempted configuration.
Local evidence is under `.cache/together/`. Keep this blocked attempt separate
from the scored Gemma, Luna, and Sol runs. Qwen3.8 Flash on this endpoint does
not meet the requested no-third-party-sharing configuration.
