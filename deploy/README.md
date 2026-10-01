# Deployment

PaperMan runs as three services: Python API, Python worker, and TanStack Start web server. The API and worker share a local data directory. The worker holds one process lock. Do not run two workers against the same directory.

For Homestack, mount the SSD first and create `/srv/homestack/paperman` with the service user's ownership. Set `PAPERMAN_DATA_DIR` to that absolute path and set `PAPERMAN_UID` and `PAPERMAN_GID` to its owner. Run `docker compose up --build -d` from this repository. The web service listens at `127.0.0.1:3020`; the existing Homestack Caddy service can proxy to this address. The API and worker do not expose host ports.

Use the web Settings page to configure the GPU endpoint and model name. The host and container must be able to reach that endpoint over Tailscale. No Tailscale address or GPU hostname is built into the application. The container includes English and German OCR language data. Set OCR languages to `deu+eng` for mixed German and English mail.

Share only the `inbox` child directory with the scanner. Test a physical scan to this share before changing the saved Mac shortcut. Check the printer and server clocks if SMB authentication fails.

Back up the entire data root, including `catalog.toml`, `settings.toml`, `scans`, `documents`, and `state`. Stop the worker and API during a simple file-copy backup for a consistent snapshot. Restore to an empty data root, keep the same relative paths, then run `paperman index` and start the services. Locks and heartbeat files do not prove that a worker is running after restore. The actual worker takes the OS lock and replaces the heartbeat.

Homestack's current `/srv/homestack` backup scope is intended to include this location. Verify the live Restic configuration and restore a sample backup before relying on it. Deployment, scanner configuration, and a physical Pi scan have not been performed by this repository's tests.
