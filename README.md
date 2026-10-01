# PaperMan

PaperMan receives PDF scans, creates searchable PDFs, proposes document groups and owners, and files approved documents. Tags and search can be rebuilt without moving the files. All persistent state is stored in ordinary files. No database is required.

## Run

Install Bun 1.3+, uv, and Tesseract with the required language data. On macOS, `brew install tesseract` installs English OCR; use `brew install tesseract-lang` for more languages. Linux packages are `tesseract-ocr` and language packages such as `tesseract-ocr-deu`.

```sh
uv sync
bun install
bun run dev
```

Open <http://127.0.0.1:3001>. This starts the Python API, the independent worker, and the web server. In Settings, add owner names and aliases, then set the model endpoint and name. The endpoint must support the OpenAI Chat Completions protocol. Ollama uses an endpoint such as `http://gpu-host:11434/v1`. Real inference requires an endpoint; PaperMan never selects a cloud fallback. A required endpoint credential belongs in `PAPERMAN_MODEL_API_KEY`, not in a committed config file.

Upload a PDF on the Scans page, or put one in `data/inbox`. The worker listens for file events and scans periodically. It waits for files to settle, preserves their bytes under a SHA-256 identity, and runs OCR. Scans need review before filing by default. Review all source pages, owners, dates, and titles; approve to file. Failed steps have retry controls. The overview reports an offline worker and failed scans or tagging.

## Local inference

In Settings, select **Ollama**, enter its `/v1` endpoint and an installed model name, and select **Native JSON schema**. For Ollama on the same machine, the endpoint is `http://127.0.0.1:11434/v1`. Reasoning can be set to `none` when the model supports it. Keep **Review all scans before filing** enabled while checking model quality. These values are configuration, not application defaults.

Pydantic AI makes separate requests for document boundaries, each document's recipient/title/issue date, and later tags/summary. Code turns boundaries into consecutive page groups so no pages are lost. Invalid boundaries, owner IDs, tag IDs, or output shapes get at most two validation retries. Valid JSON does not prove that the model understood the document. Review is still required to catch incorrect splits, names, owners, and dates.

Run the opt-in check against the model saved in the selected storage directory:

```sh
PAPERMAN_DATA_DIR=data uv run python scripts/check_inference.py
```

The check sends fictional mail through the worker, OCR, real model, review API, filing, and repeat tagging. It uses temporary storage and does not change existing documents, owners, or settings. A pass requires three correct document groups, known and unknown owners, issue dates, missing-date fallback, expected tags, unchanged file paths, and preserved user tags. It exits with an error if any check fails. Only the configured endpoint receives the sample text.

The installed `qwen3.5:0.8b` failed the mixed-mail check on 2 October 2026: it merged separate letters and missed named owners. It can test connectivity, but its filing proposals are not reliable. No larger model has been verified yet.

## Local demo

```sh
bun run demo
```

This creates 36 fictional documents and 14 scans in `.demo-data/`, then starts the API, worker, and web app at the usual address. Stop `bun run dev` first because both use the same ports. The demo includes searchable PDF previews, owner and tag catalogs, one review scan, and one retryable failure. Existing demo edits are preserved on subsequent runs. The normal `data/` folder is unchanged.

The Demo model adapter returns deterministic local sample responses behind the `Inference` interface. It makes no network calls. Upload, OCR, review, filing, search, and saved tag edits use the real local pipeline. Sample responses do not evaluate model quality. Switch the server type in Settings to use a real endpoint later.

## Routes and UI

Overview uses a centered 1152 px content area with a document list and a 288 px attention panel. Settings and its catalog forms share a centered 672 px area. Document and scan workspaces use the available width. Shared body padding grows from 16 px on phones to 32 px at desktop width.

TanStack Start serves complete pages with server rendering and route loaders. Documents, scans, scan review, document detail, owner editing, tag editing, and settings have separate URLs. Search terms, filters, sorting, pagination, and document views use URL parameters. Form drafts remain local until Save or Approve.

The UI uses shadcn Mira, Base UI, Tailwind CSS 4.3, Inter Variable, and Hugeicons. A compact top bar provides navigation. Shared workspace classes own page padding, headings, and section spacing. Use plain sections and table/list separators. Avoid cards inside cards. Keep Mira's control dimensions. The collection layout owns its search toolbar, scrolling table, empty state, and bottom pagination. Document filters sit beside search when space permits and use a popover on smaller screens; applied filters appear as removable labels. The document preview fills the remaining space. Summary and tag controls have a separate tab. Scan review uses separate scrolling for the preview and inspector. Back navigation uses one outlined chevron control. Add controls from `apps/web` with `bunx --bun shadcn@latest add <component>`.

Selecting a document or scan opens a quick preview over the right side of the table. The list stays usable. Arrow keys select items in the current list page. Enter or the Open control opens the same view at full size; close or Escape returns to the list with its filters and scroll position. Both collections share the preview frame, row controls, and keyboard behavior. Document tabs are PDF, Text, Summary, and Details. Scan tabs are PDF, Documents, Activity, and Details; filed documents use the shared document table and open the document preview. Tab changes keep the PDF mounted, including its zoom and page position.

PDF previews use EmbedPDF 2 with Mira controls for pages, zoom, rotation, text search, and download. The shared viewer serves documents, original scans, and scan review, with one steady loading surface until the first page is ready. PDFium runs in a browser worker; its WebAssembly asset is bundled with the app. External font fallback requests are disabled, so PDFs must embed any fonts that PDFium does not provide. Rotation and zoom change the view only; download returns the saved PDF.

## Processing and files

Tags have selectable icons in Settings. The catalog stores a stable icon key. Older catalogs use `auto`, which supplies icons for standard tags and a document icon for custom tags. Document rows use a subject tag icon when available.

Dropdowns use shared Mira selects, including their open menus, focus colors, and selection marks. Filters, Settings, owner reassignment, scan review, and PDF zoom use the same control. Date filters and scan review use one Mira calendar with neutral selection colors, keyboard navigation, Clear, and Today actions. Tables share header styling and cell spacing. On phones, the review PDF has a bounded height so the form is accessible below it.

Remove owners in Settings. If an owner has filed documents or scan proposals, select a replacement in the dialog; Unknown is selected by default. Reassignment updates metadata and scan proposals before removing the owner. Document IDs, PDFs, and stored paths stay unchanged, so the original owner folder can remain on disk. Removal waits until active scan processing finishes. Unknown cannot be removed.

`PAPERMAN_DATA_DIR` selects storage and defaults to `data/`. The old scaffold's `index.json` tag catalog is imported once if no catalog exists. The original index is retained.

```text
catalog.toml                      owner names, aliases, and tag catalog
settings.toml                     model endpoint, OCR, and review settings
inbox/                            incoming scanner PDFs
scans/<sha256>/original.pdf        immutable original bytes
scans/<sha256>/searchable.pdf      OCR copy with the same pages
scans/<sha256>/scan.json           checkpoints, history, proposal, document links
documents/<owner-id>/*.pdf         final searchable documents, one flat folder per owner
documents/<owner-id>/*.toml        metadata, source pages, dates, tags, errors
documents/<owner-id>/*.txt         extracted text
state/search.json                 rebuildable full-text index
state/worker.json                 worker heartbeat
```

A document date means the date printed on the document. If absent, the UTC scan date is used and marked as a fallback. Final filenames contain that date, the UTC scan timestamp, a normalized title, and a unique document ID. Every source page must occur exactly once in the review proposal. Blank pages stay with their document. Unknown is a reserved owner.

The worker resumes persisted stages after restart. A failed model call does not lose OCR output. Filing has deterministic IDs and paths, and publishes each file atomically. The original is removed from the inbox only after filing succeeds; its preserved copy remains in scan history. Exact duplicates link to the same scan. Later tagging replaces generated tags and preserves explicit user choices. Search currently uses a derived JSON text index; semantic embeddings are not required for the first pipeline.

`Storage`, `OCR`, and `Inference` define the worker's boundaries. The first implementations use a configured directory, OCRmyPDF/Tesseract, and Pydantic AI with an explicit compatible endpoint. Compute provisioning and mount setup belong to deployment configuration. The app does not require a Pi or Homestack.

## Development and checks

```sh
bun run generate:api  # FastAPI OpenAPI contract and TypeScript client types
bun run check        # format, lint, strict types, tests, production web build
uv run paperman index
bun run build
# Production: start API and worker, then the web server on its own port.
uv run paperman serve
uv run paperman worker
PORT=3001 bun run --filter @paperman/web start
```

The API defaults to port 3000. `PAPERMAN_API_URL` configures the web server's API connection. API credentials and storage paths remain server-side. Python uses uv, Ruff, Basedpyright strict, Pydantic, and pytest. Tests cover original preservation, OCR, page coverage, review, duplicates, retry, repeat tagging, and file-copy restoration.

See [deployment](deploy/README.md) for the Compose setup and Homestack SSD integration. The [active plan](.agent/plans/2026-10-01-paperman-document-pipeline.md) records the remaining live integration checks.
