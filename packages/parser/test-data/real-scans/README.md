# Scanned-document eval set

Ten public source documents, 15 pages, arranged into five eval inputs. They cover invoices, a contract, fax/form excerpts, and receipt photographs. [manifest.json](manifest.json) records source URLs, revisions, hashes, rights, and selection notes.

## Sources

| IDs   | Dataset                                                              | Inputs                                     |
| ----- | -------------------------------------------------------------------- | ------------------------------------------ |
| 01–04 | [VRDU](https://github.com/google-research-datasets/vrdu)             | Three invoices and an advertising contract |
| 05–07 | [FUNSD](https://guillaumejaume.github.io/FUNSD/)                     | Fax cover, signed order form, fax message  |
| 08–10 | [Personal invoices and receipts](https://zenodo.org/records/7213544) | Two receipts and a credit note             |

- **VRDU:** public FCC business documents. The dataset has no explicit licence; an [upstream question](https://github.com/google-research-datasets/vrdu/issues/3) remains open. Keep source PDFs and annotations outside Git.
- **FUNSD:** [terms](https://guillaumejaume.github.io/FUNSD/work/) restrict use to non-commercial research and education. Image rights remain separate. These excerpts lack attachments and cannot measure complete-document splitting.
- **Receipts:** Francisco Cruz and Mauro Castelli, 2022, DOI 10.5281/zenodo.7213544, CC BY 4.0. Preserve attribution for shared derivatives.

Originals, annotations, and full transcripts stay outside Git under `.cache/real-scans/`. Git contains manifests, labels, settings, and derived results. This is not a source-document bundle cleared for redistribution.

## Labels and batches

`ground-truth.json` defines page groups and fields, `catalog.json` fixes owner/tag choices, and `batches.json` maps source pages to inputs. SHA-256 manifests identify the fixed labels. An agent checked field labels from images before inference; they have no independent human review.

| Input | Sources         | Expected groups  | Split scoring      |
| ----- | --------------- | ---------------- | ------------------ |
| 01    | 01–04           | 1–4; 5; 6–7; 8–9 | Included           |
| 02    | 08–10           | 1; 2; 3          | Included           |
| 03–05 | 05–07, one each | 1                | Excerpts; excluded |

The complete inputs contain seven documents and five boundaries. All ten documents count for field scores. Field scores require the correct group; failures remain in the denominator. No input is blank. This small, previously used set does not establish accuracy on unseen documents.

## Run

Prepare sources from the manifest and verify their hashes. Unchanged originals are in `.cache/real-scans/inputs/`; combined PDFs follow the page map and belong in `.cache/real-scans/pdfs/`.

From `packages/parser`, use a new output directory:

```sh
uv run python -m scripts.benchmark_codex \
  --labels test-data/real-scans \
  --pdfs ../../.cache/real-scans/pdfs \
  --output ../../.cache/real-scans/runs/new-run \
  --settings /path/to/model-settings.json
```

Supply `PAPERMAN_MODEL_API_KEY` when the endpoint needs a credential. The supplied Gemma settings use an example URL; replace it with your endpoint. Alternatively, use `--model gpt-6-luna` or `--model gpt-6-sol` with Codex CLI authentication. Do not pass answer labels or reference transcripts to the model.

## Transcripts and OCR

The [OCR eval](results/2026-10-05-ocr/README.md) uses reviewed and corrected Sol transcript drafts. These are not independent double transcriptions. Unreadable regions and reading order affect the scores. The reference hashes are retained; full references stay in `.cache/real-scans/reviewed/2026-10-05/`.

To generate new drafts, use `scripts.transcribe` with explicit PDF inputs, a model, and a new output directory. It records one image request per page and does not change evaluation labels.

See [model results](results/README.md), including the [full worker and cost check](results/2026-10-05-together-glm53-e2e/README.md).
