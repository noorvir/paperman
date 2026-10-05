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
- [x] Group the Python server with its tests, scripts, dependency configuration, and lockfile alongside the web app. Root commands, strict types, all 21 tests, API schema generation, Python packaging, and the web build pass. Docker paths are updated; a container build remains unverified because Docker is unavailable locally.
- [ ] Integrate the inbox and worker with the Homestack deployment.
- [x] Implement OCR, split proposals, review, ownership, naming, and deterministic filing.
- [x] Implement repeatable tagging, full-text search, URL-based routes, and dashboard recovery controls.
- [x] Verify public scans, local model failures, worker restart recovery, and a filesystem backup restore. Physical scanner delivery, the intended GPU host, and live Homestack backups remain deployment checks.

The Python worker and API, routed TanStack Start UI, and deployment configuration are implemented. Physical scan delivery, the intended GPU endpoint, a Pi deployment, and a live backup restore remain unverified. Local model testing uses fictional mail and the public PDF test set. Household documents have not been sent to a model.

## Current local AI milestone

- [x] Apply all saved transcript edits and review notes; accept all 15 page references as directed by the user. Preserve 22 review decisions and freeze the dataset hashes. Production OCR retains nine existing text layers and adds text to six image-only pages; all outputs have text. Final diagnostic CER is 38.2% overall and 21.4% on new OCR. Reading order and unreadable regions affect scores; text-layer position remains unmeasured. Original field labels and model results are unchanged.

- [x] Generate Sol Markdown transcript drafts for all 10 real source documents (15 pages). Preserve tables, form fields, page breaks, and source language. Page coverage, hashes, and table structure pass; visual spot checks are complete. User review, plain-text references, and OCR scoring are complete above; fixed field labels are unchanged.

- [x] Rerun all eight public PDFs with Luna and image-only inputs. Exact groups, owners, and dates: 13/13. Title keywords: 12/13. Tag precision: 18/19; recall: 18/18. No failures. OCR was reused, not rerun; local model and Sol were not rerun. Keep frozen labels and saved evidence. Use "evals" for these model checks.
- [x] Find and visually inspect ten real inputs with 15 pages from VRDU, FUNSD, and published personal receipts. Cache original files and upstream labels; record sources, hashes, and rights. These improve scan realism but do not cover modern German household mail.
- [x] Freeze agent-checked labels for 10 real documents (15 pages) and run Gemma 4, Luna, and Sol on identical image inputs. Two constructed batches: Gemma 0/7 exact groups; Luna and Sol 7/7. Owners: 3/10, 10/10, 10/10. Dates: 2/10, 9/10, 10/10. Luna and Sol match all required tags; no processing failures. Exclude three excerpts from complete-document split metrics. OCR and blank-page accuracy remain unmeasured. Keep restricted source data outside Git.

- [x] Remove visually confirmed blank pages from final documents in the same image request used for splitting. Keep all original pages and their source numbers. Review can restore omitted pages; all-blank scans and retained pages without OCR text require review. Sixteen parser tests and fourteen focused server tests pass, including repeat filing, restoration, and invalid omission checks. A two-PDF Luna image check omitted all expected blanks and retained pen-only content with a review reason. Strict types and web build pass. The review form was not visually checked in this turn. Real scanner noise and the local model remain unverified. Keep positioned local OCR until an image OCR adapter can supply a verified searchable text layer.

- [x] Use rendered page images alone for all model stages. Extract split, details, and enrichment prompts into typed Python functions in one prompt package. Keep OCR text for search only. Update worker, standalone parser, benchmark tools, and checks; preserve recorded text-only baselines. Strict types, lint, 13 parser tests, and 16 server tests pass. A two-PDF Luna check used images only and recovered the missing issue-date distinction. The full Luna image eval is recorded above; local-model vision support remains unmeasured.

- [x] Benchmark GPT-6 Luna with the signed-in Codex account on the fixed public test set, then GPT-6 Sol because Luna was below 100%. Identical OCR text, prompts, catalogs, and scoring; no label changes. Luna: 94.7% tag precision, 100% recall, all owners correct. Sol: 85.0% precision, 94.4% recall, 12/13 owners correct. Both dates: 12/13; both groups: 13/13. A separate Luna image check recovered the date label lost by OCR. Saved predictions and request evidence; flag ambiguous tag and synthetic-document rules for review. This cloud approval covers public test data only; application processing stays local.
- [x] Finish the local pipeline end to end with the current model; defer Jev. Printer-to-Pi delivery and live polling integration remain outside this milestone.
- [x] Pass the final quality checks: formatting, lint, strict Python and web types, 11 parser tests, 16 server tests, and the production web build. Check edit and page-group controls in the browser at desktop and phone widths.
- [x] Read all 18 public PDF pages visually and freeze transcripts, a fixed catalog, and 13 document labels before evaluation. Labels are agent-reviewed, not human-reviewed. Save predictions, source/settings hashes, stage times, and measured scores.
- [x] Complete edit mode, including page-group correction after filing. Edit from quick preview must open the full document route with `edit=true`; the preview stays read-only. Title, owner, issue/fallback date, summary, tags, and extracted text now save as one revision-checked sidecar update. Save/Cancel and desktop/phone layouts were checked in the browser. Preserve originals, provenance, user changes, and identities where the same document remains. Group corrections reuse review, preserve unchanged groups, publish replacements through a saved scan revision, and archive replaced files. Invalid ranges, interrupted publication/retry, repeated grouping, and desktop/phone Save/Cancel checks pass.
- [x] Verify upload, OCR, split/review, filing, enrichment, search, corrections, repeated processing, failure/retry, and restart recovery through the local application. All eight public PDFs produced 13 reviewed documents. A live worker recovered from a model outage, termination during analysis, and a tagging outage. A backup copy restored files and search. Edit mode and grouping were checked at desktop and phone sizes.
- [x] Separate OCR, AI adapters, parsing contracts, and parser tests into a standalone package. Move public samples under test data. Preserve current prompts and model request settings for the baseline. Ten parser tests pass without the server installed; twelve server tests, strict types, formatting, package build, and web build pass. The API contract is unchanged. Container paths are updated; Docker is unavailable for a container build.
- [x] Complete and freeze public-sample ground truth before scoring: per-page OCR text, page groups, recipient IDs against a fixed catalog, issue dates or verified absence, and expected tags. Distinguish unreviewed fields from verified missing fields.
- [x] Run the local Gemma baseline and one revised-instruction run on the eight public PDFs. Exact grouping improved from 6/8 to 8/8; owner accuracy from 7/13 to 10/13; issue-date accuracy from 4/13 to 10/13. Revised tag precision is 15/21 and recall is 15/18. Both measured runs completed without processing failures. CER/WER and reading-order limits are recorded. This is a small known set, not an unseen-mail accuracy estimate.
- [x] Review DocJev for later comparison. Consider typed category/boundary questions, descriptions for category rules, context windows, per-page OCR checks, and saved evaluation results. Its Jev adapter uses a hosted service; retain the private endpoint for this baseline. Do not adopt its blank-page segmentation or category-driven cuts without tests against PaperMan's rules.
- [x] Cache eight public PDFs with sources, licences, hashes, and expected page groups. Inspect all 18 rendered pages, including four image-only pages and a six-document claim packet. Parser evaluation and the reviewed application workflow both pass on this set.
- [x] Commit the UI work before the AI changes.
- [x] Separate boundary detection, recipient/title/date extraction, and enrichment behind the existing inference interface. Validate page coverage and catalog IDs, with bounded retries. Test native JSON, prompted JSON, and tool output.
- [x] Add an opt-in worker check using fictional mixed mail and temporary storage. It checks model accuracy before approving filing, then checks tagging, provenance, and repeat processing.
- [x] Verify connection failure and retry through the worker and API. Keep the original and OCR output, show the connection error, and resume to review when Ollama is available. Handle wrapped SDK errors; test connection, timeout, and HTTP failures.
- [x] Pass the mixed-mail check with the installed Gemma 4 E2B Q8_0 through the Llama app. Correct groups, owners, issue dates, missing-date fallback, titles, tags, review, filing, original preservation, repeat tagging, and index checks passed on 2 October 2026. Llama and Ollama have separate model lists; the earlier Ollama check missed Llama's installed models. Real mail and longer batches remain unverified.

```text
Inference.analyze(PDF bytes, owner_catalog) -> Analysis
  start_pages + blank_pages -> ordered retained groups -> recipient, title, issue_date per group
Inference.enrich(document PDF bytes, tag_catalog) -> tags, suggestions, summary
Worker owns review, filing, retries, and state; the adapter owns PDF rendering and model calls.
Model input: ordered page images, instructions, page count, and catalogs; no OCR text.
```

Standalone parser contract:

```text
parse(PDF bytes, catalog, injected OCR, injected inference, OCR languages)
  -> searchable PDF bytes, ordered page text, validated document proposals
proposal = documents[source pages, recipient ID, title, optional issue date, confidence, review reason], blank_pages
every source page = retained once in order OR explicitly marked blank
enrich(document PDF bytes, catalog) -> tags, suggestions, summary
```

The parser has no server, intake, saved-state, or clock dependency. OCR may use temporary files which are removed after each call. Inputs can come from a scanner, an upload, or a future API. The server supplies catalogs and provider settings, saves checkpoints, applies the recorded intake date when an issue date is absent, and publishes files. Enrichment remains separate so it can run again without OCR or new splits. Repeated parsing has no persistent side effects; model output is not guaranteed to be identical. Evaluation records must identify input hashes, catalogs, OCR settings, model settings, and code revision.

Research: [DocJev architecture](https://github.com/jerryjliu/docjev/blob/main/docs/architecture.md) and [published real-document pilot](https://github.com/jerryjliu/docjev/blob/main/benchmarks/results/real-small-v1-run01/report.md). The pilot reports 40/40 classifications and 7/8 exact splits for Jev. Decision latency excludes OCR; labels had no human review. This is evidence from a small test, not a production accuracy claim.

## Current UI milestone

- [x] Disable native image dragging and browser image selection in the shared PDF viewer so they cannot interrupt PDF text selection. Keep page interactions with the PDF selection layer across previews, full documents, scans, and review. Web types, formatting, and the production build pass. The drag gesture remains for the user to check in the browser.

- [x] Use selective review by default: model confidence below 0.9, an explicit uncertainty reason, or a validation/OCR problem stops filing. Clear absence of an owner or date can use the existing fallback. Plain-English corrections update the review draft, with Undo and explicit approval before filing. Ten parser and eighteen server checks pass, plus strict types, lint, and the web build. Model accuracy and browser interactions remain unmeasured for this feature.

```text
Review draft + user instructions -> configured parser adapter -> revised Analysis
Input: saved searchable PDF, current draft, owner catalog, user instructions
Output: validated page groups, blank pages, owners, titles, dates, confidence, review reasons
The parser owns inference; the API validates scan state and page coverage.
Feedback updates the browser draft only. Approve owns saved changes and filing.
```

- [x] Register uploaded PDFs before returning success and link directly to their scan progress. Preserve duplicate scan state and reject invalid uploads before intake. Mark Unknown owners and missing dates with shared amber field styling and accessible review hints. Seven upload/API/progress tests, strict types, lint, and the web build pass. Browser layout remains for the user to check.

- [x] Store processed PDFs as `YYYY-MM-DD-title-with-dashes-<milliseconds>.pdf`. Reserve paths before publication and resolve collisions without overwrites. Renamed 87 local processed documents, including both demo libraries, with a backup and resumable migration. IDs, PDF/text contents, metadata, and source scans are preserved. All 36 live PDF links pass. Thirteen filing, rename, recovery, and ownership tests, strict types, lint, and the web build pass. Rows show only the filename below the title; browser layout remains for the user to check.

- [x] Share the processed-document table across Overview, Documents, and scan results. Show the title above the saved output path, followed by Owner and Tags. Remove separate Title and Location columns. Status results carry the document record for the same table; retain panel bounds and existing preview/filter actions. Five API tests, strict types, lint, and the production build pass. The live API confirms saved output paths and metadata. Browser layout remains for the user to check.

- [x] Keep Timeline as the Overview summary. Remove the variant switch, extra heading, and top divider. Group it with the page header. Keep moderate end spacing and center labels below their nodes. Preserve the stable list and attention panel. Desktop/phone checks, types, and the production build pass for the header change; the final spacing adjustment needs a user visual check.

- [x] Try Counters, Timeline, and Tabs as alternative Overview summaries. Show one summary and replace the existing main list when a status is selected. Preserve both panel bounds, retain results while loading, and scroll each panel internally. Desktop and phone checks cover empty/single/paginated results, keyboard use, view changes, and reload; bounds remain unchanged. Status counts include tagging failures and exclude unpublished work. Five API tests, strict types, and the production build pass. Keep detailed stages on scan details.

- [x] Preview one shared horizontal pipeline component at `/pipeline-preview` before integration. Show scan steps and counts at each step, with compact green/yellow/red states for complete, remaining, and failed work. Processing, review, failure, and completion examples pass desktop and phone browser checks. Web types and production build pass.
- [x] Integrate the shared timeline into scan details with separate status messages and read-only nodes. Derive progress from saved state, combine split/identify as Analysis, and include tagging failures after filing. Desktop/phone checks cover scan links and horizontal scrolling. API tests cover failure/retry, review, filing, and enrichment. Types and production build pass.
- [ ] Add the top-right processing ring and scrollable work menu, with entries linked to scan progress. Put loading behavior in the shared button: replace its icon with a spinner, or replace its text when no icon exists; preserve button width.

- [x] Replace duplicate filter chips with one set of controls. Owners and tags accept multiple values; match any value within a group and intersect groups. Use one compact date-range control with Apply, Cancel, and Clear. Desktop and phone browser checks cover multiple selections, keyboard use, metadata links, reload/back, list/grid previews, pagination reset, and nested mobile controls. The API regression, strict types, lint, and production web build pass. EmbedPDF reports a worker-cleanup warning on a full reload from the grid; filter checks have no errors.

- [x] Share metadata filter links across tags, owners, and document dates. Keep other filters, sort, and layout; reset pagination. Reuse them in document lists, grids, scan documents, and quick/full document headers. Desktop and phone checks cover combined filters, exact dates, keyboard activation, scan navigation, and layout-preserving reset. Web types and build pass.

- [x] Integrate the file list and first-page grid into Documents and scan details. Show the saved filename, AI title, owner, tags, and folder. Reuse PDF icons and tag links in Overview and document summaries; tag popups use a 200 ms hover delay. Keep the last selection after Escape and show focus on the row background. Desktop/phone navigation, tag filters, list/grid selection, formatting, web types, and production build pass.

- [x] Match PDF loading controls to the ready toolbar through one shared layout. Use faint static placeholders, remove visible loading text and the guessed page shape, and keep the same background. Desktop and phone geometry checks pass; phone controls fit without overflow. Web types and build pass.

- [x] Keep the preview panel mounted when the selected document changes; reset only the document editor draft. Browser checks confirm stable document and scan panels across row clicks and arrow navigation, Enter to full view, and Edit/Cancel. Web types and production build pass.

- [x] Open full-page edit mode from the preview with `edit=true`. Keep quick preview read-only. Save and Cancel return to the full document view. The editor retains its draft during live refresh, uses shared controls, and leaves the PDF mounted. Backend tests cover stale drafts, immediate text search, preserved source bytes, repeated enrichment, and text edits made during inference.

- [x] Repeat the consistency check across calendars, scan/document row previews, keyboard navigation, Settings, tag editing, owner reassignment, Overview, and upload. Add a selected-order check mark to sorting; let its menu fit the labels. Stack Settings fields on phones so values stay readable. No new browser errors were observed.
- [x] Complete the app consistency pass: shared Mira calendars in filters and scan review; shared scan/document previews, row clicks, arrow/Enter/Escape navigation, Open controls, and table spacing. Scan documents use the same document table and preview route. Check Overview, lists, preview tabs, review, upload, catalog forms, owner reassignment, and missing-page states at desktop and phone widths. Date selection, keyboard use, mobile filter Apply, types, formatting, and production build pass. Native date/select controls are absent from application code.
- [x] Replace native dropdowns with shared Mira selects in filters, Settings, owner reassignment, scan review, and PDF zoom. Menus use rounded corners, neutral highlights, and selected-item check marks. Desktop/phone inspection, keyboard selection, filter submission, form values, nested menus, PDF zoom, types, and build pass.
- [x] Add owner removal: unused owners can be removed directly; used owners require a reassignment dialog with Unknown selected. Update document metadata and scan proposals under the write lock; preserve document IDs, PDFs, and paths. Unknown is reserved, and removal is blocked during active scan processing. Twelve focused tests cover reassignment, invalid targets, worker races, and interrupted filing. Desktop/phone dialog checks, Cancel/Escape, strict types, focused lint/format, and production build pass.
- [x] Verify Add tag after React deduplication. Fresh loads, navigation from document preview, and creating/reopening a tag pass; navigation and Save passed again on 4 October. The reported hook crash did not recur. Its original cause remains unconfirmed because the failed tab was unavailable.
- [x] Refine the shared preview: table top border, visible Open action, Summary tab, and list keyboard navigation (arrows select; Enter opens full view).
- [x] Show document filters inline when space permits; use the compact filter menu on smaller screens. Left-align dates and add sort icons.
- [x] Save a selectable icon on catalog entries and use tag icons across document lists, summaries, and Settings. Old catalogs use automatic icons. Verified persistence, Save/Cancel, desktop/mobile filters, arrow/Enter/Escape navigation, shared top border, full preview height, and retained PDF rendering across tabs. Three catalog/API tests, strict Python and web types, focused lint/format checks, and the production build pass. Browser console is clear.

```text
Document/scan list -> selected route: arrow keys select; Enter expands
Document view -> PDF | Text | Summary | Details: PDF stays mounted
Scan view -> PDF | Documents | Activity | Details: PDF stays mounted
Tag editor -> existing catalog API -> TOML: icon = auto | supported icon key
```

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
- Validate page count, readability, and text extraction. Keep existing text and source page numbers; run automatic rotation during OCR. Reject OCR errors and changed page counts. Allow pages without extracted text to reach visual analysis.

### 3. Split and assign owners

- AI groups the batch into logical documents, preserving page order and multi-page letters. Validate that every source page is accounted for, including pages explicitly marked blank or requiring review.
- Detect blank pages in that same image request. Omit confirmed blanks only from final documents; originals and the searchable scan retain every page. Keep signatures, stamps, photos, forms, faint text, and uncertain content. A text-bearing page cannot be automatically omitted. Record omitted source numbers; review can restore them. All-blank scans require confirmation before completion with no filed documents.
- Assign each document one owner from a filesystem catalog. Start with names: likely the user, his wife, and possibly his company. Use a defined unknown/miscellaneous owner when none matches; do not force a match.
- Resolve uncertain splits or filing details before final publication. Use one catalog owner per document. Selective review is the default; review confidence below 0.9, explicit uncertainty, invalid coverage, and unreadable retained pages. A clearly absent owner or date can use Unknown or the scan date. Keep an option to review all scans.

### 4. Date, name, and file

- Extract the date printed on the letter/document. If no reliable date is found, use the scan date and record that fallback. The field is document_date: it records the issue date, not proof of actual delivery.
- AI proposes a short, useful title, such as "Physiotherapy invoice" or "Electricity bill". Apply uniform filename rules in code. The title need not express every detail because tags follow.
- Filename is `<document-date>-<title-with-dashes>-<unix-milliseconds>.pdf`. Start with the scan timestamp in milliseconds and advance by one if the name is occupied. Reserve each document's path in the scan checkpoint before writing files; keep IDs in metadata. Existing local processed documents are renamed explicitly with their sidecars.
- Each owner has one flat directory of final PDFs and adjacent metadata files. Settle splitting, owner, dates, and filename before publication. Final document identities and paths remain fixed during later processing.
- Each metadata file identifies its original scan, source pages, and later tags. Review corrects owner/name/split before filing. Full-page edit mode corrects filed metadata and extracted search text. Page-group correction after filing remains required. Ordinary enrichment must not relocate files or overwrite explicit user corrections.
- Removing an owner can reassign filed documents through metadata. Keep their original storage paths and update scan proposals so interrupted filing can resume.

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
Tag: id, name, icon(auto | supported icon key)
Scan: id, scanned_at, timestamp_source, original_name, content_hash,
      original_location, document_ids, filing_paths(document_id -> reserved path), stage_states
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
- [ ] Mixed mail splits correctly, known owners match, unmatched mail uses unknown, and missing dates use the recorded scan date. The fictional Gemma 4 test passes; representative real scans remain unverified.
- [x] Filenames are consistent and unique; each owner's directory is flat; enrichment leaves paths unchanged.
- [x] Duplicate arrival, interrupted filing, and model endpoint failure produce visible, recoverable outcomes in local checks. The intended GPU host remains a deployment check.
- [x] Repeated tagging/indexing creates no duplicates and preserves user edits; indexes can be rebuilt.
- [x] Catalogs and state can be read without the running application; a local file-copy restore recovers documents and provenance. Live Restic restore remains pending.

## Implementation choices and remaining verification

TOML sidecars are canonical document metadata; each scan has a JSON checkpoint/history. SHA-256 identifies exact scan bytes. Dates use the printed document issue date, with a recorded UTC scan-date fallback. Owner IDs include a readable name and stable suffix. Unknown is reserved. Selective review is the default; invalid coverage, unreadable retained pages, and uncertain output require review. Approved paths are fixed. User tag choices override generated tags. A JSON full-text index is derived from text/PDFs and can be rebuilt. Semantic embeddings remain optional.

OCRmyPDF with local Tesseract embeds the searchable text layer. Pydantic AI supports configured compatible and Ollama endpoints, output modes, and reasoning controls. Network/model failures are visible, with manual retry; structured output has bounded validation retries. No automatic external fallback exists.

Remaining checks: intended GPU endpoint and representative mixed mail, live Pi storage and scanner delivery, container build on a Docker host, and Homestack backup restoration. Deployment and printer changes require their own explicit request. Owner names and the endpoint can be set in the UI. No model endpoint is preselected in real application data.

Reference: [Paperless-ngx consumer](https://github.com/paperless-ngx/paperless-ngx/blob/dev/src/documents/management/commands/document_consumer.py) for file discovery, stability checks, and periodic scans.
