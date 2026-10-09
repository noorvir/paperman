# PaperMan

PaperMan turns scanned PDFs into a searchable document library. It splits scan batches into documents, identifies owners and dates, and adds titles, tags, and summaries. A web interface lets you review uncertain results and correct document groups.

## Goals

- Keep original scans and store documents as ordinary PDF, text, and metadata files.
- Automate filing, with review when a page or field is unclear.
- Let you choose the storage location, document source, and AI provider.

## Get started

Install Node.js 24+, Python 3.13+, [uv](https://docs.astral.sh/uv/), [Bun](https://bun.sh/) 1.3+, Poppler, and Tesseract. Install Tesseract language data for the documents you expect to scan.

On macOS, the system packages are available with `brew install poppler tesseract tesseract-lang`. On Debian or Ubuntu, use `poppler-utils` and `tesseract-ocr`, plus the required language packages.

From the repository root:

```sh
uv sync --project apps/server
bun install
bun run dev
```

Open <http://127.0.0.1:3001>. In **Settings**, add owners and choose a model endpoint and model ID. The model must support multiple image inputs and structured output through an OpenAI-compatible API or Ollama. Supply any API key through `PAPERMAN_MODEL_API_KEY`.

Upload a PDF from **Scans**, or put it in `data/inbox/`. Processing runs in the background. Review items can be corrected with manual controls or plain-English instructions.

The model checks page orientation and document groups from the original images. PaperMan then turns pages upright and runs OCR once. A document can have several owners. It appears once in the library, with PDF, text, and metadata copies in each owner's folder. Owner changes update these copies; original scans stay unchanged.

In a document's **Edit** view, click source pages to include or exclude them, then select **Save changes**. New pages go at the end. Edit a page’s blue number to move it within the document; the other page numbers update automatically. A page can belong to several documents; editing one document does not change the others. Retained pages keep their saved rotations, and verification stays unchanged. Changing the selection refreshes extracted text unless you also save a text correction.

To apply new processing settings to a completed scan, open it in **Scans** and select **Reprocess**. Confirm to replace all its results, including manual edits. PaperMan starts from the original PDF and keeps existing documents available until the new PDFs are filed. If processing fails or needs review, the old documents remain available. After filing, previous PDFs, text, and metadata are archived under that scan's `revisions/` directory, and tags and summaries are generated again. **Retry failed stage** resumes a failed run without starting over.

Each document records its source scan, source pages, and processing run. The scan's **Details** tab shows model cost estimates by run, including recorded retries. Document cost estimates include only their own run. These estimates exclude hardware, storage, tax, and test calls made outside the worker.

For a filed document, select **Reprocess** and confirm to generate tags, tag suggestions, and a summary again. Only that document's PDF goes to the current model. Its page groups, owners, date, title, PDF, and file location stay unchanged; OCR and scan analysis do not run again. Saved tag choices and summary or text corrections take priority. A failure keeps the previous results and can be retried with the same action. Additional model usage is included in the document's **Details** cost table.

**Processed at** shows the last successful document processing time in the user's local time zone. Successful reprocessing updates it; manual edits and failed runs do not. Older records use their saved completion event or successful model call timing when available. Missing times show `-`.

Documents start as unverified. Use the normal PDF, Text, Summary, and Details tabs to check the document. The Source tab, also available through the source file link, shows the original scan and its details in the same document view. The document side panel has **View in context** controls that show the full scan with unrelated pages dimmed while keeping the PDF tab and document details. Turn context off to return to the document PDF. The context toggle is available only in the full document sidebar. List previews show a verification badge beside the linked title; open the full document to verify it. Click outside a preview to close it. Collection rows keep their normal selection and opening behavior. It starts at the first source page and dims unrelated pages. The scan sidebar links to the other extracted documents; narrow views have expandable source details. Source remains available after verification.

Select **Verify** to save verification immediately, without leaving the current view. After saving, the Verify button disappears and a green verified icon appears beside the title; its tooltip shows Verified. Reserved header space prevents layout shifts. The table uses the same icon-only badge, centered in its column. During saving, a circular spinner replaces its icon; the text and width stay unchanged. Metadata records the time and reviewer `unknown` when authentication is disabled, or the signed-in user’s name when enabled. Cards and the table show verification status. Edits and document reprocessing retain verification; scan reprocessing retains it when source pages match.

Select a document or scan to preview it. Select the same row again to open the full page. Full scan pages show scan details and links to the extracted documents in a sidebar.

Document editing shows the PDF beside Details, Summary, and Text tabs. In edit mode, the PDF rotate button turns the current page by 90 degrees. Save changes updates the filed PDF and all owner copies; Cancel discards the rotation. The text layer and original scan are retained. Outside edit mode, rotation changes only the view. Changes stay in one draft until you select **Save changes**. **Edit pages** opens the source scan's page groups. Leaving any edit form with unsaved changes asks you to keep editing or discard them; reloading or closing the tab uses the browser's confirmation.

To try the interface without an AI service, run `bun run demo` instead. It uses fictional documents in a separate `.demo-data/` directory.

## Optional authentication

PaperMan works without login by default. Enable [authentication and owner access](docs/authentication.md) to use admin-created accounts, personal/admin modes, and per-owner document access. Users can edit metadata and verify permitted documents; only admin mode can change owners or pages, access full scans, or change global settings.

## Connect your setup

- **Storage:** set `PAPERMAN_DATA_DIR` to a writable directory. It defaults to `data/`.
- **Document source:** upload PDFs through the web app/API, or have a scanner or import job write to the inbox.
- **AI service:** configure the endpoint, model, and output mode in Settings. Document images go to that endpoint; OCR runs locally.
- **Hosting:** run the API, worker, and web app together. Use your own network access controls and back up the complete data directory.

See [deployment](deploy/README.md) for Docker Compose, configuration, and backups. The [parser package](packages/parser/README.md) can also be used on its own.

## Development

The React/TanStack web app is in `apps/web`; the Python API and worker are in `apps/server`. The parser provides OCR and model interfaces. The API contract is in [openapi.json](openapi.json).

```sh
uv sync --project packages/parser
bun run check         # Formatting, types, tests, and build
bun run generate:api  # Refresh OpenAPI and web client types
```

For browser checks, start an isolated app with a copy of test data and Chrome with remote debugging enabled. Set both URLs and the isolated data path:

```sh
PAPERMAN_TEST_DATA_DIR=/absolute/path/to/test-data \
PAPERMAN_WEB_URL=http://127.0.0.1:3001 \
PAPERMAN_BROWSER_URL=http://127.0.0.1:9224 \
bun --filter @paperman/web test:browser
```

These tests cover navigation, previews, verification, page order, tags, sorting, time settings, and failed saves. Some tests write to the isolated documents and settings, then restore them. Do not point this suite at your working library.

Model checks use [public PDF samples](packages/parser/test-data/public-pdfs/README.md) and [scanned documents](packages/parser/test-data/real-scans/README.md). Results describe those test sets, not expected accuracy on every document.
