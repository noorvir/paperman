# Deployment

PaperMan runs as a web app, a Python API, and one worker. The API and worker share a filesystem directory. Run only one worker per data directory.

## Docker Compose

1. Create a data directory and give the service user write access.
2. Copy `.env.example` to `.env`. Set `PAPERMAN_DATA_DIR` to the directory's absolute path and `PAPERMAN_UID`/`PAPERMAN_GID` to its owner's IDs.
3. Supply `PAPERMAN_MODEL_API_KEY` if your provider requires a key.
4. Run `docker compose up --build -d` from the repository root.

Open <http://127.0.0.1:3020>. Choose the model endpoint and model ID in Settings. The endpoint must be reachable from the worker container; `localhost` inside a container refers to that container. The image includes English and German OCR data.

The web port binds to loopback by default. The API has no published host port. For remote access, use an authenticated reverse proxy or a private network. PaperMan does not provide application authentication.

## Integration boundaries

| Boundary  | Contract                                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage   | A shared writable filesystem with file locks and atomic rename. `FileStorage` implements the `Storage` protocol. Mounts and permissions belong to the deployment. |
| Intake    | PDF upload through the API or files written into `<data-dir>/inbox/`. Expose only the inbox to a scanner or import job.                                           |
| OCR       | PDF bytes and language codes in; a searchable PDF with the same page count and ordered text out. `LocalOCR` uses OCRmyPDF/Tesseract.                              |
| Inference | PDF bytes, catalogs, and optional review instructions in; validated proposals or enrichment out. Endpoint settings and credentials are supplied to the adapter.   |
| Web/API   | The web server uses `PAPERMAN_API_URL`, which defaults to `http://127.0.0.1:3000`. Compose supplies the internal API address.                                     |

The [parser guide](../packages/parser/README.md) describes the OCR and inference interfaces. Storage currently requires filesystem semantics; object storage is not supported.

## Files and backups

The data directory contains:

```text
catalog.toml       Owners and tags
settings.toml      Model, OCR, review, and optional pricing settings
inbox/             Incoming PDFs
scans/             Originals, OCR copies, processing records, and revisions
documents/         Filed PDFs with TOML metadata and extracted text
state/             Search index and worker state
```

Filed names use `YYYY-MM-DD-title-with-dashes-<milliseconds>.pdf`. The date comes from the document, with the scan date as a fallback. Original scans are preserved.

Back up the whole directory. For a file-copy backup, stop the API and worker first. To restore, copy into an empty data directory, run `docker compose run --rm api paperman index`, then start the services. Test that originals and filed documents open after restoration.

For an older library, `paperman rename-documents` updates filenames while preserving document IDs. Back up first and stop the API and worker; repeat the command if it is interrupted.

Estimated model costs appear in document Details. Optional pricing in `settings.toml` records the model, endpoint, token rates, source, and check date. Missing rates or usage produce an unknown cost. See the [pricing example](../packages/parser/test-data/real-scans/together-glm-settings.json).
