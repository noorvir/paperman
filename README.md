# PaperMan

PaperMan receives PDF scans, creates searchable PDFs, proposes document groups and owners, and files approved documents. Tags and search can be rebuilt without moving the files. All persistent state is stored in ordinary files. No database is required.

## Run

Install Bun 1.3+, uv, Poppler, and Tesseract with the required language data. Poppler renders the page images sent to the model (`brew install poppler` on macOS; `poppler-utils` on Linux). On macOS, `brew install tesseract` installs English OCR; use `brew install tesseract-lang` for more languages. Linux packages are `tesseract-ocr` and language packages such as `tesseract-ocr-deu`.

```sh
uv sync --project apps/server
uv sync --project packages/parser  # Standalone parser checks
bun install
bun run dev
```

Open <http://127.0.0.1:3001>. This starts the Python API, the independent worker, and the web server. In Settings, add owner names and aliases, then set the model endpoint and name. The endpoint must support the OpenAI Chat Completions protocol. Ollama uses an endpoint such as `http://gpu-host:11434/v1`. Real inference requires an endpoint; PaperMan never selects a cloud fallback. A required endpoint credential belongs in `PAPERMAN_MODEL_API_KEY`, not in a committed config file.

Upload a PDF on the Scans page, or put one in `data/inbox`. The worker listens for file events and scans periodically. It waits for files to settle, preserves their bytes under a SHA-256 identity, and runs OCR. Clear scans are filed automatically by default. Model confidence below 0.9, an explicit review reason, invalid page coverage, unreadable retained pages, and all-blank scans require review. A clearly absent owner or date can use Unknown or the scan date. Failed steps have retry controls. The overview reports an offline worker and failed scans or tagging.

## Local inference

Llama and Ollama are separate apps with separate model lists and endpoints. Check the server for the app that holds the installed model. In Settings, use **Compatible API** for Llama's llama.cpp server or **Ollama** for Ollama, then enter the endpoint and model ID. Select **Native JSON schema**. Enable **Review all scans before filing** if every scan must be checked. Existing saved settings are retained.

On the review page, use the manual controls or **Describe changes** to give instructions in plain English. **Update proposal** uses the configured model and the current draft to revise page groups and document details. The result stays in the form and can be undone; **Approve and file** saves it. The same controls can correct page groups after filing. Model confidence is a self-reported estimate, not measured accuracy.

Verified local Llama settings:

| Setting       | Value                               |
| ------------- | ----------------------------------- |
| Server type   | Compatible API                      |
| Endpoint URL  | `http://127.0.0.1:9931/v1`          |
| Model name    | `ggml-org/gemma-4-E2B-it-GGUF:Q8_0` |
| Output format | Native JSON schema                  |
| Reasoning     | none                                |

The Llama app must be running. These settings belong to this local installation; the endpoint and model stay configurable for other hosts. Ollama usually uses `http://127.0.0.1:11434/v1` on the same machine.

Pydantic AI makes separate requests for document boundaries, each document's recipient/title/issue date, and later tags/summary. Code turns boundaries into consecutive page groups so no pages are lost. Invalid boundaries, owner IDs, tag IDs, or output shapes get at most two validation retries. Valid JSON does not prove that the model understood the document. Review is still required to catch incorrect splits, names, owners, and dates.

Run the opt-in check against the model saved in the selected storage directory:

```sh
PAPERMAN_DATA_DIR=data uv run --project apps/server python apps/server/scripts/check_inference.py
```

The check sends fictional mail through the worker, OCR, real model, review API, filing, and repeat tagging. It uses temporary storage and does not change existing documents, owners, or settings. A pass requires three correct document groups, known and unknown owners, issue dates, missing-date fallback, expected tags, unchanged file paths, and preserved user tags. It exits with an error if any check fails. Only the configured endpoint receives the sample text.

The earlier text-input pipeline with Gemma 4 E2B Q8_0 passed the full mixed-mail check through the Llama app on 2 October 2026: three correct groups, owners, dates, titles, tags, review, filing, and repeat tagging. The test used fictional English mail; real scans and longer batches still need review. Qwen3.5 0.8B through Ollama failed the same accuracy check. Gemma 3 1B and 4B are also installed in Llama but have not been evaluated.

The [public PDF test set](packages/parser/test-data/public-pdfs/README.md) has eight PDFs with 18 pages, including image-only scans, financial tables, French text, and a six-document claim packet. Ground truth was written from page images before evaluation. Both the standalone parser evaluation and the application upload/review/filing checks are complete. See [accuracy, workflow checks, and limits](packages/parser/test-data/public-pdfs/results/README.md). The current model still needs review for owners, dates, and tags.

## Local demo

```sh
bun run demo
```

This creates 36 fictional documents and 14 scans in `.demo-data/`, then starts the API, worker, and web app at the usual address. Stop `bun run dev` first because both use the same ports. The demo includes searchable PDF previews, owner and tag catalogs, one review scan, and one retryable failure. Existing demo edits are preserved on subsequent runs. The normal `data/` folder is unchanged.

The Demo model adapter returns deterministic local sample responses behind the `Inference` interface. It makes no network calls. Upload, OCR, review, filing, search, and saved tag edits use the real local pipeline. Sample responses do not evaluate model quality. Switch the server type in Settings to use a real endpoint later.

## Routes and UI

Overview uses a centered 1152 px content area with a document list and a 288 px attention panel. Settings and its catalog forms share a centered 672 px area. Document and scan workspaces use the available width. Shared body padding grows from 16 px on phones to 32 px at desktop width.

TanStack Start serves complete pages with server rendering and route loaders. Documents, scans, scan review, document detail, owner editing, tag editing, and settings have separate URLs. Search terms, filters, sorting, pagination, and document views use URL parameters. Form drafts remain local until Save or Approve.

The UI uses shadcn Mira, Base UI, Tailwind CSS 4.3, Inter Variable, and Hugeicons. A compact top bar provides navigation. Shared workspace classes own page padding, headings, and section spacing. Use plain sections and table/list separators. Avoid cards inside cards. Keep Mira's control dimensions. The collection layout owns its search toolbar, scrolling table, empty state, and bottom pagination. Document filters sit beside search when space permits and use a popover on smaller screens; applied filters appear as removable labels. The document preview fills the remaining space. Summary and assigned tags have a separate tab. Scan review uses separate scrolling for the preview and inspector. Back navigation uses one outlined chevron control. Add controls from `apps/web` with `bunx --bun shadcn@latest add <component>`.

Selecting a document or scan opens a quick preview over the right side of the table. The list stays usable. Arrow keys select items in the current list page. Enter or the Open control opens the same view at full size; close or Escape returns to the list with its filters and scroll position. Both collections share the preview frame, row controls, and keyboard behavior. Document tabs are PDF, Text, Summary, and Details. Scan tabs are PDF, Documents, Activity, and Details; filed documents use the shared document table and open the document preview. Tab changes keep the PDF mounted, including its zoom and page position.

The document quick preview is read-only. Its Edit button opens `/documents/<id>?edit=true` in the full workspace. The editor changes title, owner, issue date, summary, tags, and extracted text. Save applies the draft; Cancel discards it. Both return to the full document view. The PDF stays mounted. Text corrections update search and future tagging without changing the original PDF. If another operation changes the saved document while a draft is open, Save reports a conflict and retains the draft.

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
scans/<sha256>/scan.json           checkpoints, history, proposal, active document links
scans/<sha256>/revisions/          previous groupings and replaced document files
documents/<owner-id>/*.pdf         final searchable documents, one flat folder per owner
documents/<owner-id>/*.toml        metadata, source pages, dates, tags, errors
documents/<owner-id>/*.txt         extracted text
state/search.json                 rebuildable full-text index
state/worker.json                 worker heartbeat
```

A document date means the date printed on the document. If absent, the UTC scan date is used and marked as a fallback. Final filenames use `YYYY-MM-DD-title-with-dashes-<milliseconds>.pdf`. The suffix starts with the scan's Unix timestamp in milliseconds and increases by one if that name is occupied. The worker saves the allocated path before writing the PDF so retries use the same name. Document IDs stay in metadata. Every source page must occur exactly once in a document group or in the proposal's blank-page list. The split model identifies blank pages from images; filed documents omit them, while originals retain all pages. Retained pages with no readable text and entirely blank scans require review, even when automatic filing is enabled. Review can restore omitted pages. Unknown is a reserved owner.

To rename an existing library, stop its API and worker, then run `PAPERMAN_DATA_DIR=/path/to/library uv run --project apps/server paperman rename-documents`. Back up the library first. The command renames each PDF with its text and metadata files, updates saved paths, and preserves document IDs and source scans. If interrupted, run the same command again before starting the services. A saved rename plan lets it resume without choosing new destinations.

The worker resumes persisted stages after restart. A failed model call does not lose OCR output. Filing has deterministic IDs and saved paths, and publishes each file atomically. The original is removed from the inbox only after filing succeeds; its preserved copy remains in scan history. Exact duplicates link to the same scan. Later tagging replaces generated tags and preserves explicit user choices. Search currently uses a derived JSON text index; semantic embeddings are not required for the first pipeline.

Use **Edit page groups** from a full document editor or a filed scan to correct splits and merges. The review form starts with current document metadata. Save validates page coverage and checks that no document changed while the form was open. Unchanged page groups keep their IDs, file paths, tags, summaries, and text corrections. Changed groups get new IDs and pending tagging; their old PDFs, text, and metadata move to scan history after publication. The previous document set stays visible if filing fails. Retry resumes the approved revision. Metadata edits do not rename or move files.

`Storage`, `OCR`, and `Inference` define the worker's boundaries. OCR and inference live in the standalone parser package, which accepts PDF bytes and returns searchable content and proposals. The server saves checkpoints and publishes approved files. The first implementations use a configured directory, OCRmyPDF/Tesseract, and Pydantic AI with an explicit compatible endpoint. Model requests use only rendered PDF page images plus instructions and catalogs; OCR text stays local for search and review. The configured model must accept multiple images. Compute provisioning and mount setup belong to deployment configuration. The app does not require a Pi or Homestack.

## Development and checks

```text
apps/web/                               React web app
apps/server/paperman/                    API, worker, review, storage, filing
apps/server/tests/                       Server integration tests
apps/server/scripts/                     Demo setup and local model checks
packages/parser/paperman_parser/         Standalone OCR and AI parsing
packages/parser/tests/                   Parser tests, no server required
packages/parser/test-data/public-pdfs/    Public sample manifest and labels
deploy/                                 Container configuration
```

Each Python project has its own `pyproject.toml` and `uv.lock`. The server installs the parser as a local editable dependency. See the [parser interface and DocJev research](packages/parser/README.md).

Run the commands below from the repository root. Server dependencies are installed in `apps/server/.venv`; standalone parser checks use `packages/parser/.venv`. Runtime commands use the root working directory, so `.env`, `data/`, `.demo-data/`, and generated `openapi.json` resolve there.

```sh
bun run generate:api  # FastAPI OpenAPI contract and TypeScript client types
bun run check        # format, lint, strict types, tests, production web build
uv run --project apps/server paperman index
bun run build
# Production: start API and worker, then the web server on its own port.
uv run --project apps/server paperman serve
uv run --project apps/server paperman worker
PORT=3001 bun run --filter @paperman/web start
```

The API defaults to port 3000. `PAPERMAN_API_URL` configures the web server's API connection. API credentials and storage paths remain server-side. Python uses uv, Ruff, Basedpyright strict, Pydantic, and pytest. Tests cover original preservation, OCR, page coverage, review, duplicates, retry, repeat tagging, and file-copy restoration.

See [deployment](deploy/README.md) for the Compose setup and Homestack SSD integration. The [active plan](.agent/plans/2026-10-01-paperman-document-pipeline.md) records the remaining live integration checks.
