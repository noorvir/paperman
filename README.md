# PaperMan

PaperMan is a web workspace for scanned documents in Homestack. It has one PDF inbox and a persistent tag catalog. The AI pipeline is the next stage; this code does not yet split, classify, tag, or file documents automatically.

## Structure

| Workspace      | Job                                                                   |
| -------------- | --------------------------------------------------------------------- |
| `apps/web`     | React UI for the inbox and tags                                       |
| `apps/server`  | Bun HTTP server, Effect I/O, SQLite tag storage, and static web files |
| `packages/api` | Shared oRPC contract and Effect schemas                               |

The inbox contains **scan batches**. A batch can contain several letters. A future pipeline will preserve the batch, make separate logical documents, and assign tags to those documents. Tags in this first stage are a catalog; they are not assigned to batches.

## Run locally

Requires Bun 1.3 or newer.

```sh
cd paperman
bun install
bun run dev
```

Open `http://127.0.0.1:3001`. The API runs on port 3000; Vite forwards `/rpc` to it. Put a PDF in `paperman/data/inbox` to see it on the web page. The page checks the inbox every ten seconds. `paperman/data` is ignored by Git.

```sh
bun run check
bun run build
bun run --filter @paperman/server start
```

After a build, the server also serves the web app at `http://127.0.0.1:3000`.

## Pi storage boundary

`PAPERMAN_DATA_DIR` selects the data directory. The intended Pi path is `/srv/homestack/paperman` on the existing SSD, with originals in `/srv/homestack/paperman/inbox` and tag data in `/srv/homestack/paperman/paperman.sqlite`. The existing Homestack Restic job includes `/srv/homestack`, but a PaperMan backup and restore test has not been done.

The printer still sends scans to the Mac share. No Pi share, printer shortcut, container, or Pi service is configured by this scaffold. Keep the Mac destination until a real scan to the Pi succeeds.

For a later Pi service, bind the web server to the approved private interface, mount the data directory, and make an inbox share for the printer. Then add ingestion, OCR, splitting, review, tagging, filing, duplicate handling, and backup verification. Each phase must preserve the source PDF.
