# PaperMan

PaperMan is a standalone web application for scanned documents. It has one PDF inbox and a persistent tag catalog. The AI pipeline is the next stage; this code does not yet split, classify, tag, or file documents automatically.

The [document pipeline plan](.agent/plans/2026-10-01-paperman-document-pipeline.md) defines the Python backend, portable filesystem storage, custom web UI, and configurable model connection. The current scaffold still uses Bun, Effect, and oRPC.

## Structure

| Workspace      | Job                                                             |
| -------------- | --------------------------------------------------------------- |
| `apps/web`     | React UI for the inbox and tags                                 |
| `apps/server`  | Bun HTTP server, Effect I/O, file storage, and static web files |
| `packages/api` | Shared oRPC contract and Effect schemas                         |

The inbox contains **scan batches**. A batch can contain several letters. A future pipeline will preserve the batch, make separate logical documents, and assign tags to those documents. Tags in this first stage are a catalog; they are not assigned to batches.

## Run locally

Requires Bun 1.3 or newer.

```sh
cd paperman
bun install
bun run dev
```

Open `http://127.0.0.1:3001`. The API runs on port 3000; Vite forwards `/rpc` to it. Put a PDF in `data/inbox` to see it on the web page. The page checks the inbox every ten seconds. `data/` is ignored by Git.

```sh
bun run check
bun run build
bun run --filter @paperman/server start
```

After a build, the server also serves the web app at `http://127.0.0.1:3000`.

## Storage and deployment

`PAPERMAN_DATA_DIR` selects the data directory and defaults to `data/` in this repository. Scans are read from its `inbox/` directory, and tags are stored in `index.json`. The server reads tag state from disk, replaces the index atomically, and expects one writer process. Storage does not require a Pi or Homestack.

Homestack is the first intended deployment: it will supply the mounted SSD directory, service configuration, scanner share, and backups. `/srv/homestack/paperman` is an example host path, not an application requirement. The existing Homestack Restic job includes `/srv/homestack`, but a PaperMan backup and restore test has not been done.

The printer still sends scans to the Mac share. No Pi share, printer shortcut, container, or Pi service is configured by this scaffold. Keep the Mac destination until a real scan to the Pi succeeds.

The planned worker receives storage and model interfaces through dependency injection. The first storage implementation uses ordinary files under a configured root; the first model endpoint runs on the user's GPU machine over Tailscale. Hostnames, mount paths, and provider choices belong in deployment configuration. Each processing phase must preserve the source PDF.
