# Current Work: PaperMan document pipeline

## Goals

Build PaperMan as a standalone repository with a custom web UI and a simple, reliable document pipeline. Storage and inference are injected interfaces; Homestack is the first deployment target. Scans land in configured filesystem storage (initially the Pi SSD), become searchable PDFs, and are split, assigned an owner, named, and filed. Later enrichment adds tags and search data without moving the filed documents. Failures must be visible and recoverable; exhaustive fault tolerance is unnecessary.

## Progress

- [x] Capture the pipeline requirements and separate confirmed choices from open decisions.
- [x] Create the initial web inbox and tag-catalog scaffold with filesystem storage.
- [x] Extract PaperMan into its own repository with its code history and plans.
- [ ] Settle the open formats, review rules, model, and API choices below.
- [ ] Implement the Python foundation and portable storage/model interfaces.
- [ ] Integrate the inbox and worker with the Homestack deployment.
- [ ] Implement OCR, splitting, ownership, naming, and final filing.
- [ ] Implement repeatable tagging, search, and dashboard recovery controls.
- [ ] Verify real scans, GPU failures, restart recovery, and backup restoration.

This plan defines the next implementation. The scaffold has no OCR or AI worker, and PaperMan is not deployed. A complete physical scan delivery remains unverified.

## Scope and constraints

- Python backend; retain the custom React/TypeScript web UI. No desktop, mobile, or Apple application.
- Follow the shared and Python coding skills: uv and application lockfile, Basedpyright strict with Any diagnostics, Ruff, Pydantic boundary validation, and essential pytest tests. Prefer explicit functions and readable code.
- FastAPI and Pydantic AI remain proposals. No LiteLLM. Decide the Python/web API contract during migration.
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
- Record duplicate arrivals without producing duplicate final documents. The exact timestamp/hash naming and duplicate policy remain open.

### 2. Create a searchable PDF

- Run the basic OCR stage before AI document organisation, using the configured local/self-hosted model or selected OCR pipeline.
- Produce a PDF with embedded searchable/selectable text that follows the visible pages. Extracted text or Markdown alone does not meet this requirement. Preserve the unmodified source separately.
- Validate page count, readability, and text extraction. Retain page identifiers for later splitting. Decide how to handle existing text, rotation, and blank pages; do not silently discard pages.

### 3. Split and assign owners

- AI groups the batch into logical documents, preserving page order and multi-page letters. Validate that every source page is accounted for, including pages explicitly marked blank or requiring review.
- Assign each document one owner from a filesystem catalog. Start with names: likely the user, his wife, and possibly his company. Use a defined unknown/miscellaneous owner when none matches; do not force a match.
- Resolve uncertain splits or filing details before final publication. Shared ownership and the review policy still need a decision.

### 4. Date, name, and file

- Extract the date printed on the letter/document. If no reliable date is found, use the scan date and record that fallback. An issue date is not proof of actual delivery; clarify the user's term "received date" before fixing the field names.
- AI proposes a short, useful title, such as "Physiotherapy invoice" or "Electricity bill". Apply uniform filename rules in code. The title need not express every detail because tags follow.
- Filename contains the selected document date, scan date/time, title, and a unique identifier. Illustrative shape: `<date>__scanned-<timestamp>__<title>__<id>.pdf`; exact format remains open.
- Each owner has one flat directory of final PDFs and adjacent metadata files. Settle splitting, owner, dates, and filename before publication. Final document identities and paths remain fixed during later processing.
- Each metadata file identifies its original scan, source pages, and later tags. A correction procedure for an already-filed owner/name/split remains open; ordinary enrichment must never relocate files.

### 5. Archive the original scan

- Once all resulting documents and their metadata are safely filed, move the original batch out of the inbox into a scan archive/history. Keep its record and links to every derived document so it is not ingested again.
- Failed or incomplete batches remain recorded and retryable. A partially completed batch must not be reported as complete or duplicate existing outputs on retry.
- Tagging/search can remain pending after filing and archiving. Their failures are tracked separately and must stay visible.

### 6. Enrich and index

- Assign multiple tags from a filesystem catalog. Provide a useful initial set; let users select, add, and manage tags. The UI can suggest new tags through AI for user acceptance.
- This stage can run again as models, prompts, catalogs, and tagging logic improve. Reuse document IDs and paths; replace generated results instead of appending duplicates. Preserve explicit user tag edits separately from AI output.
- Idempotence applies to stored effects; a new model or prompt can produce different classifications. Record the inputs/versions needed to explain the latest result.
- Support keyword/full-text search and consider embeddings for semantic search. Keep indexes derived and rebuildable from PDFs/text and metadata. Metadata files alone are not an efficient search index; choose a simple file-based format later, without introducing a database.

## Filesystem state contract

JSON or TOML sidecars are acceptable; TOML is the current preference. Choose one canonical metadata format. Minimal logical records, independent of serialization:

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
- Select model/server/library after testing document inputs, OCR output, and structured results on real samples. An API-compatible server alone does not establish vision or OCR quality.

## Failures and validation

Dashboard: show pending/running/completed work, failed stage and reason, review items, and retry actions. Include worker unavailability, GPU/network failures, OCR errors, invalid model output, and storage failures. If state cannot be written, surface unhealthy storage instead of success.

Keep retry/restart behaviour small: bounded automatic retries where useful, manual retry, disk checkpoints, and one active worker lock. One bad batch must not stop other batches. A restart can rerun unfinished work without duplicating filed documents.

## Success criteria / essential checks

- [ ] A real Pi scan is discovered by events and periodic scans without consuming a partial upload.
- [ ] Originals survive; searchable PDFs preserve pages and map final documents back to their batch.
- [ ] Mixed mail splits correctly, known owners match, unmatched mail uses unknown, and missing dates use the recorded scan date.
- [ ] Filenames are consistent and unique; each owner's directory is flat; enrichment leaves paths unchanged.
- [ ] Duplicate arrival, interrupted filing, and GPU failure produce visible, recoverable outcomes.
- [ ] Repeated tagging/indexing creates no duplicates and preserves user edits; indexes can be rebuilt.
- [ ] Catalogs and state can be read without the running application; a backup can restore documents and provenance.

## Decisions before implementation

Choose JSON/TOML; scan/filename identity rules and timezone; date terminology; owner names and initial tags; review/correction rules; OCR/searchable-PDF tooling and model/server/library; FastAPI/client contract; retry limits and initial search/index format. Keep embeddings optional until the first document flow works. Deployment and printer changes require their own explicit request.

Reference: [Paperless-ngx consumer](https://github.com/paperless-ngx/paperless-ngx/blob/dev/src/documents/management/commands/document_consumer.py) for file discovery, stability checks, and periodic scans.
