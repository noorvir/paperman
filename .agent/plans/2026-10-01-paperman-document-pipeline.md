# Current Work: PaperMan document pipeline

## Goals

Build PaperMan as a standalone repository with a custom web UI and a simple, reliable document pipeline. Storage and inference are injected interfaces; Homestack is the first deployment target. Scans land in configured filesystem storage (initially the Pi SSD), become searchable PDFs, and are split, assigned an owner, named, and filed. Later enrichment adds tags and search data without moving the filed documents. Failures must be visible and recoverable; exhaustive fault tolerance is unnecessary.

## Progress

- [x] Capture the pipeline requirements and separate confirmed choices from open decisions.
- [x] Create the initial web inbox and tag-catalog scaffold with filesystem storage.
- [x] Extract PaperMan into its own repository with its code history and plans.
- [x] Set up shadcn Mira and Tailwind with shared dense layouts for the inbox and tags.
- [x] Choose TOML metadata/catalogs/settings, JSON job records, SHA-256 scan IDs, UTC timestamps, review before filing, local OCRmyPDF, FastAPI/OpenAPI, and Pydantic AI. The production model endpoint remains pending.
- [x] Implement the Python foundation and portable storage/model interfaces.
- [ ] Integrate the inbox and worker with the Homestack deployment.
- [x] Implement OCR, split proposals, review, ownership, naming, and deterministic filing.
- [x] Implement repeatable tagging, full-text search, URL-based routes, and dashboard recovery controls.
- [ ] Verify real scans, GPU failures, restart recovery, and backup restoration.

The Python worker and API, routed TanStack Start UI, and deployment configuration are implemented. Eleven automated tests and the production build pass. Physical scan delivery, the intended GPU endpoint, a Pi deployment, and a live backup restore remain unverified. Local model testing uses synthetic content only; the installed 0.8B model has returned invalid results.

## Current UI milestone

The user has approved local sample data and fake inference for this milestone. Keep sample storage separate from real documents. The fake adapter uses the existing inference interface and makes no network requests.

Document preview: selecting a row opens a panel over the right side of the table, sliding left into view as shown in the user's sketch. The existing document route owns the selected document and PDF/Text/Details state. Expanding changes the same mounted view to full mode; closing restores the list and its filters/scroll position. The list stays usable beside the panel. Keep the PDF mounted across view changes, with one stable loading surface until its first page is ready.

- [x] Add the shared quick/full document preview and remove repeated PDF flashes. Browser checks confirm one loading-to-ready transition, the same rendered PDF across tabs and expansion, rapid document changes, close/Escape/back, retained search and list scroll, and 390 px controls without overflow. The scan collection keeps its layout. Web types, formatting, and production build pass.

- [x] Populate a useful sample library, PDF previews, review jobs, and failure states.
- [x] Simplify search and filters, share collection layouts, and anchor pagination below the growing list.
- [x] Inspect and exercise the rendered UI in a browser; check empty results, filters, pagination, upload, review, and narrow layouts.
- [x] Replace the sidebar with compact top navigation and share one compact header across list, detail, review, and settings pages.
- [x] Fill the remaining viewport with the PDF or text panel. Keep preview loading states the same size and scroll the preview and inspector independently.
- [x] Verify the compact layout across desktop and narrow screens, including navigation, view changes, and scrolling.
- [x] Increase shared body padding; center the two-column Overview and the narrower Settings area while keeping document and scan tables wide. Verify centered margins, Settings tab/edit alignment, bottom pagination, and remaining preview height on desktop; check Overview and Settings at phone width.
- [x] Use one outlined chevron for all header back links and remove redundant PDF links outside the preview.
- [x] Replace the basic preview with stable EmbedPDF and Mira controls for page navigation, zoom, rotation, text search, and download. Bundle the rendering engine locally and disable external font requests. The user approved EmbedPDF after learning that React PDF Viewer is archived.
- [x] Verify the new viewer in development and production: page navigation and direct page selection on a three-page scan, zoom, rotation, download, search highlights/results/empty results, and Escape to close search. Inspect the 390 px toolbar and search layout without horizontal overflow; confirm full-height previews and outlined back navigation. Web types, formatting, and build pass.

Compact-layout checks cover 1633×1314, 1280×720, and 390×844 viewports. Shared headers keep the same 44 px height. PDF, text, and metadata panes keep the same bounds; PDF and review-form scrolling leave the app header in place. List pagination stays at the bottom. Upload, catalog back links, settings, and overview were also inspected. Web types, formatting, and production build pass; the browser has no new errors or warnings.

Browser checks cover populated and empty lists, owner filters, search, sorting, pagination, PDF/text views, upload, review/filing, failure retry, saved tags, and mobile navigation. The local PDF viewer fixes the blank browser preview. A worker regression test now checks that heartbeat writes do not prevent periodic intake. Eleven tests, strict types, lint, formatting, and the production build pass. Real inference quality and live infrastructure checks remain separate.

## Scope and constraints

- Python backend; retain the custom React/TypeScript web UI. No desktop, mobile, or Apple application.
- Use shadcn Mira with Base UI and Tailwind for compact controls and consistent theme tokens. Share page layouts and spacing; use plain sections and row separators rather than nested bordered cards. Preserve accessible controls and readable text.
- Follow the shared and Python coding skills: uv and application lockfile, Basedpyright strict with Any diagnostics, Ruff, Pydantic boundary validation, and essential pytest tests. Prefer explicit functions and readable code.
- FastAPI owns the HTTP API; OpenAPI generates the TypeScript client contract. Pydantic AI validates model output. No LiteLLM. TanStack Start owns SSR, file routes, loaders, and URL search parameters.
- Persistent state belongs in ordinary files: human-readable, agent-readable, easy to parse, diff, and optionally commit. No database. Runtime processes reconstruct their state from disk.
- Keep application code independent of Homestack, Pi hardware, mount paths, and Tailscale addresses. The first filesystem implementation receives a configured root and can run on any supported host. No database or speculative cloud-storage implementation is required.
- Homestack owns its SSD mount, scanner share, Ansible/Compose deployment, and backup configuration. PaperMan exposes runtime configuration and storage/model interfaces. Verify backup inclusion and restoration; documents are not automatically committed or published with application code.
- Custom UX is required. Borrow Paperless-ngx's ingestion and recovery ideas and useful libraries; its application and UI are not the foundation.
- Start with one worker and clear write ownership. Avoid a distributed queue or general workflow framework.

## Consumer interfaces and ownership

```text
Scanner -> inbox: timestamped PDF scan batch, possibly containing several letters
Dashboard -> API: inspect jobs/errors/documents; edit owner/tag catalogs; review/retry
Worker -> injected storage: discover, checkpoint, preserve originals, publish documents
Filesystem storage(root) -> files: scans, catalogs, job state, PDFs, metadata, indexes
Worker -> injected model adapter: OCR, split proposal, owner/date/title, enrichment
Model adapter -> configured inference endpoint: request/response only
```

The worker owns processing decisions and recovery. The storage implementation owns file access and safe publication; its consumer contract covers scan discovery, source reads, state/catalog updates, and document publication. Host mount/share setup stays in deployment tooling. The AI returns proposals, not filesystem actions. API and worker mutations must use one defined write path or locking rule so user edits are not lost.

## Pipeline

### 1. Receive and identify a scan

- A daemon listens for filesystem events and also scans at startup and periodically. It runs independently of the browser and web requests.
- The first deployment's inbox is on the SSD attached to the Pi; the application accepts a configured location. Keep the working Mac SMB shortcut until a real Pi scan succeeds. Current scans are duplex, 300 dpi, one timestamped PDF per job, with blank-page removal disabled.
- Wait for uploads to settle before ingestion; check file stability and PDF readability. Assign a unique scan identity and scan timestamp. Consider a content hash for identity/storage and exact-duplicate detection; a timestamp alone can collide. Preserve the original filename and bytes.
- Record duplicate arrivals without producing duplicate final documents. SHA-256 identifies scan bytes; UTC file modification time records arrival/scan time. Duplicate arrivals are added to the existing scan history.

### 2. Create a searchable PDF

- Run the basic OCR stage before AI document organisation, using the configured local/self-hosted model or selected OCR pipeline.
- Produce a PDF with embedded searchable/selectable text that follows the visible pages. Extracted text or Markdown alone does not meet this requirement. Preserve the unmodified source separately.
- Validate page count, readability, and text extraction. Retain page identifiers for later splitting. Keep existing text, run automatic rotation during OCR, and retain blank pages with their document. Reject OCR output that changes page count or has no readable text.

### 3. Split and assign owners

- AI groups the batch into logical documents, preserving page order and multi-page letters. Validate that every source page is accounted for, including pages explicitly marked blank or requiring review.
- Assign each document one owner from a filesystem catalog. Start with names: likely the user, his wife, and possibly his company. Use a defined unknown/miscellaneous owner when none matches; do not force a match.
- Resolve uncertain splits or filing details before final publication. Use one catalog owner per document. Review all scans by default; always review uncertain groups, invalid coverage, and unknown owners.

### 4. Date, name, and file

- Extract the date printed on the letter/document. If no reliable date is found, use the scan date and record that fallback. The field is document_date: it records the issue date, not proof of actual delivery.
- AI proposes a short, useful title, such as "Physiotherapy invoice" or "Electricity bill". Apply uniform filename rules in code. The title need not express every detail because tags follow.
- Filename contains the selected document date, scan date/time, title, and a unique identifier. Illustrative shape: `<date>__scanned-<timestamp>__<title>__<id>.pdf`; the implementation uses UTC scan timestamps and the full scan hash plus document number.
- Each owner has one flat directory of final PDFs and adjacent metadata files. Settle splitting, owner, dates, and filename before publication. Final document identities and paths remain fixed during later processing.
- Each metadata file identifies its original scan, source pages, and later tags. Review is the supported correction point for owner/name/split. Filed identities and paths are immutable; ordinary enrichment must never relocate files.

### 5. Archive the original scan

- Once all resulting documents and their metadata are safely filed, move the original batch out of the inbox into a scan archive/history. Keep its record and links to every derived document so it is not ingested again.
- Failed or incomplete batches remain recorded and retryable. A partially completed batch must not be reported as complete or duplicate existing outputs on retry.
- Tagging/search can remain pending after filing and archiving. Their failures are tracked separately and must stay visible.

### 6. Enrich and index

- Assign multiple tags from a filesystem catalog. Provide a useful initial set; let users select, add, and manage tags. The UI can suggest new tags through AI for user acceptance.
- This stage can run again as models, prompts, catalogs, and tagging logic improve. Reuse document IDs and paths; replace generated results instead of appending duplicates. Preserve explicit user tag edits separately from AI output.
- Idempotence applies to stored effects; a new model or prompt can produce different classifications. Record the inputs/versions needed to explain the latest result.
- Support keyword/full-text search and consider embeddings for semantic search. Keep indexes derived and rebuildable from PDFs/text and metadata. Metadata files alone are not an efficient search index; use a derived JSON full-text index, without introducing a database.

## Filesystem state contract

TOML is the canonical document sidecar and catalog format. JSON holds per-scan checkpoints and history. Minimal logical records, independent of serialization:

```text
Owner: id, name                         # includes a reserved unknown owner
Tag: id, name
Scan: id, scanned_at, timestamp_source, original_name, content_hash,
      original_location, document_ids, stage_states
Document: id, scan_id, source_pages, owner_id, title, document_date,
          date_source(document | scan_fallback), scanned_at, final_path,
          user_tags, generated_tags, enrichment_version, stage_states
StageState:
  pending | running(started_at) | succeeded(finished_at)
  | failed(at, message, attempt) | needs_review(reasons)
```

Use safe file replacement and a small persisted error/attempt history. Do not make one global index the only record of progress. Retain IDs, provenance, and user edits when regenerating derived data.

## Model execution boundary

- First target: the user's own GPU machine, reached over Tailscale. Configure the adapter, endpoint, model, credentials if needed, and timeout; hardcode none of them in the pipeline.
- Support a replaceable inference implementation. Another machine with the same protocol is a configuration change; another protocol/provider uses an adapter. Keep compute provisioning separate until required.
- Local/self-hosted processing is the default. No document transmission to an external AI provider or automatic cloud fallback. A provider such as OpenAI may be selected explicitly later. Rented compute such as Modal is a separate privacy/deployment choice.
- Pydantic AI provides structured output and compatible/Ollama adapters. Select the production model/server after testing real samples. An API-compatible server alone does not establish vision or OCR quality.

## Failures and validation

Dashboard: show pending/running/completed work, failed stage and reason, review items, and retry actions. Include worker unavailability, GPU/network failures, OCR errors, invalid model output, and storage failures. If state cannot be written, surface unhealthy storage instead of success.

Keep retry/restart behaviour small: bounded automatic retries where useful, manual retry, disk checkpoints, and one active worker lock. One bad batch must not stop other batches. A restart can rerun unfinished work without duplicating filed documents.

## Success criteria / essential checks

- [ ] A real Pi scan is discovered by events and periodic scans without consuming a partial upload.
- [x] Originals survive; searchable PDFs preserve pages and map final documents back to their batch.
- [ ] Mixed mail splits correctly, known owners match, unmatched mail uses unknown, and missing dates use the recorded scan date.
- [x] Filenames are consistent and unique; each owner's directory is flat; enrichment leaves paths unchanged.
- [ ] Duplicate arrival, interrupted filing, and GPU failure produce visible, recoverable outcomes.
- [x] Repeated tagging/indexing creates no duplicates and preserves user edits; indexes can be rebuilt.
- [x] Catalogs and state can be read without the running application; a local file-copy restore recovers documents and provenance. Live Restic restore remains pending.

## Implementation choices and remaining verification

TOML sidecars are canonical document metadata; each scan has a JSON checkpoint/history. SHA-256 identifies exact scan bytes. Dates use the printed document issue date, with a recorded UTC scan-date fallback. Owner IDs include a readable name and stable suffix. Unknown is reserved. Every scan is reviewed by default; invalid page coverage, uncertain output, and unknown ownership always require review. Approved paths are fixed. User tag choices override generated tags. A JSON full-text index is derived from text/PDFs and can be rebuilt. Semantic embeddings remain optional.

OCRmyPDF with local Tesseract embeds the searchable text layer. Pydantic AI supports configured compatible and Ollama endpoints, output modes, and reasoning controls. Network/model failures are visible, with manual retry; structured output has bounded validation retries. No automatic external fallback exists.

Remaining checks: intended GPU endpoint and representative mixed mail, live Pi storage and scanner delivery, container build on a Docker host, and Homestack backup restoration. Deployment and printer changes require their own explicit request. Owner names and the endpoint can be set in the UI. No model endpoint is preselected in real application data.

Reference: [Paperless-ngx consumer](https://github.com/paperless-ngx/paperless-ngx/blob/dev/src/documents/management/commands/document_consumer.py) for file discovery, stability checks, and periodic scans.
