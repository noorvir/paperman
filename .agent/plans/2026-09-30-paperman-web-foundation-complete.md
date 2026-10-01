# PaperMan web foundation

## Intent

Create a Bun TypeScript workspace for PaperMan within Homestack. The first usable flow reads PDF scan batches from one inbox on the Pi SSD and lets the user manage a tag catalog in a web UI.

## Boundaries

- The printer continues to scan to the Mac until a Pi destination is tested.
- Original PDFs in the inbox are read, never moved or changed by this foundation.
- No AI split, OCR, classification, or automatic filing is claimed in this phase.
- Use an oRPC contract for the web and server boundary. Use Effect for backend I/O and use cases.
- Keep the web, API contract, and server as the only workspaces. Do not add Apple apps.

## Consumer shape

```text
Web UI -> oRPC: list inbox, list tags, create tag, delete tag
Server -> data directory: read inbox PDFs, store tag catalog
Future worker -> inbox batches: split and classify into logical documents
```

## Progress

- [x] Create workspace and source structure.
- [x] Implement inbox and tag boundary.
- [x] Build web UI and validate the full local flow.
- [x] Document Pi paths and next pipeline stage.
- [x] Explain the result in Whiteboard.
