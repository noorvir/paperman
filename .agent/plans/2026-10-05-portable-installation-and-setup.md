# Current Work: Portable installation and setup

## Goals

Prepare PaperMan for a public, independent installation. A user or agent can install it, select storage and a model, connect a document source, and verify the complete flow. A Pi, SSD, scanner brand, and Tailscale are deployment choices.

## Non-goals

- Deploy to the user's Pi or change the working printer configuration in this task.
- Add a database, distributed queue, setup wizard, or automatic cloud model fallback.
- Build adapters for every storage service or scanner before one is needed.

## Current Direction

### Interfaces and ownership

```text
Source -> watched inbox OR upload(PDF bytes) -> scan ID and processing status
Parser.parse(PDF bytes, catalog, OCR, inference) -> searchable PDF and Analysis
Analysis = documents[source pages, owner, title, issue date], blank source pages
Inference.analyze(PDF bytes, catalog) -> Analysis
Inference.enrich(document PDF bytes, catalog) -> tags, suggestions, summary
Server -> durable jobs, review, retries, filing, metadata and search
Storage -> originals, filed PDFs, metadata, catalogs and recoverable job state
```

- Sources only deliver documents. They do not classify, name, or file them. A scanner share, manual upload, and a future API integration use the same intake contract.
- Keep the parser stateless and independently testable. Inject OCR and inference; keep source transport, deployment details, storage paths, and credentials outside it.
- The model adapter receives an explicit endpoint, model name, timeout, and secret reference. Verify image input and structured output. A compatible API alone is insufficient. Default to local or self-hosted inference; external providers require explicit configuration.
- The first supported working store is a configured filesystem root. It contains all canonical state. Indexes are derived and can be rebuilt. Ordinary files remain readable without PaperMan.
- The present storage contract exposes paths and file locks. Document these limits. A network mount must pass locking, atomic-write, and recovery checks. Do not claim that an arbitrary cloud URL works.
- For another storage service, first define its role: canonical working store or destination copy. Keep destination copying separate from successful local filing and track its failures. A canonical remote store needs a byte/key contract and tested publication/concurrency semantics before support is claimed. Implement only the adapter selected for a real deployment.

### Setup flow for a user or agent

1. Select the host, persistent working storage, intake method, model endpoint, owner/tag catalogs, OCR languages, review policy, and backup destination.
2. Install from documented prerequisites or verified container images. Supply environment/config files; keep machine-specific values and secrets out of the repository.
3. Run a setup check. Check storage access and write guarantees, OCR languages, PDF rendering, image-capable inference, API/worker health, and persistent volumes. Return clear failures, a nonzero exit code, and optional structured results for agents.
4. Process a bundled fictional sample. Verify the original, search text, splits, omitted blank pages, owner/date fallback, tags, filenames, metadata, and retry after a model failure.
5. Connect the source. For a scanner, point its share destination to the inbox. Check server/printer clocks, permissions, complete-file detection, and duplicate delivery. For API intake, document upload, status, review, and retry calls.
6. Test one real delivery with the selected configuration. Confirm unattended operation under the selected review policy. Show failures and pending review in the dashboard.
7. Configure startup and backup. Restart the services, restore a backup into separate storage, rebuild search, and verify document bytes and provenance.

Keep each setup operation independently repeatable. Checks must explain what passed, what failed, and what remains unverified. Do not report an unsupported source, store, or model as ready.

### Release preparation

- Write one generic setup guide and an agent-readable configuration/API reference. Keep Homestack as a separate worked example.
- Verify dependency installation, container builds, volume ownership, health checks, restarts, and updates on supported CPU architectures. State the tested platform limits.
- Document backup consistency, restore, storage permissions, and network exposure/access requirements for the supported deployment.
- Select a repository licence with the owner. Check copied-code notices, sample licences, secret exclusion, and removal of private runtime data before publication.
- State current model accuracy limits. Default review stays enabled until users choose otherwise. All-blank scans and uncertain content require review; omitted pages remain recoverable from originals.

## Success Criteria

- [ ] A fresh user or agent can complete setup without personal machine details or undocumented steps.
- [ ] Scanner and API intake reach the same processing flow.
- [ ] Storage and model checks detect unsupported configurations before real use.
- [ ] The sample passes from delivery to filed, searchable documents with recorded provenance.
- [ ] Failed processing is visible and retryable; restart and duplicate delivery create no duplicate documents.
- [ ] A backup restore recovers originals, metadata, catalogs, jobs, and search.
- [ ] Public-release licence, notices, examples, and data/secret checks are complete.

## Tests / Validation

Use a clean installation with temporary storage and fictional/public PDFs. Check a local disk first, then the actual network store if one is selected. Test model refusal/timeouts, incomplete uploads, blank backs, all-blank scans, OCR failure, restart, and restore. Test the real scanner only during its deployment task. Record tested platforms and unresolved limits.

## Progress

- [x] Record the existing interfaces, filesystem limits, and portable setup flow.
- [ ] Implement the setup checks and generic documentation.
- [ ] Verify a fresh installation and public-release requirements.
- [ ] Connect and validate the user's Pi, storage, model host, and scanner in a separate deployment task.
