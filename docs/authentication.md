# Optional authentication

Authentication is **disabled by default**. Better Auth runs in the web server. The Python API enforces document access. The worker does not use the auth database or auth secrets.

## Enable

Set these values on the web server:

```dotenv
PAPERMAN_AUTH_ENABLED=true
PAPERMAN_AUTH_URL=https://paperman.example.com
PAPERMAN_AUTH_DATABASE=/persistent/auth/auth.sqlite
PAPERMAN_AUTH_SECRET=<random secret, at least 32 characters>
PAPERMAN_API_AUTH_SECRET=<different random secret, at least 32 characters>
```

Set `PAPERMAN_AUTH_ENABLED=true` and the same `PAPERMAN_API_AUTH_SECRET` on Python. Both services must use the same mode. The web server rejects API responses when the modes do not match. Invalid settings fail closed. Generate each secret with a password manager or `openssl rand -hex 32`; do not commit them.

Use HTTPS for the browser. Keep Python on loopback or a private container network. For separate hosts, use HTTPS or an authenticated private network between services. Do not publish the Python port.

Compose applies the same mode and API secret to both services. The persistent `auth` volume is mounted only in the web container. Do not remove it during deployment. Without Docker, use an absolute persistent path writable by the web service account.

Better Auth migrations run before auth requests are served. Session mode is stored in the auth database. Inboxes, routing suggestions, and explicit document access are stored with the documents. Owner names remain catalog metadata and never grant access. Back up the database and auth secret separately from documents. Use SQLite's backup facility or stop the web service before copying the database and its WAL files.

## First administrator

Public signup is disabled. Bootstrap refuses to run after any account exists. Load the auth settings above, then set temporary bootstrap values:

```sh
export PAPERMAN_BOOTSTRAP_EMAIL='you@example.com'
export PAPERMAN_BOOTSTRAP_NAME='Your name'
read -s PAPERMAN_BOOTSTRAP_PASSWORD
export PAPERMAN_BOOTSTRAP_PASSWORD
bun --filter @paperman/web bootstrap:admin
unset PAPERMAN_BOOTSTRAP_PASSWORD
```

Use at least 12 characters. With Compose, after setting the same temporary values in your shell, run:

```sh
docker compose exec \
  -e PAPERMAN_BOOTSTRAP_EMAIL \
  -e PAPERMAN_BOOTSTRAP_NAME \
  -e PAPERMAN_BOOTSTRAP_PASSWORD \
  web node bootstrap-admin.mjs
unset PAPERMAN_BOOTSTRAP_PASSWORD
```

Sign in, select **Switch to admin mode**, then **Manage users**. Create accounts, change roles, set shared-mail routing suggestions, suspend accounts, reset passwords, and end sessions there. Each account has one personal inbox. Creating accounts through Manage users provisions it immediately; existing and bootstrapped accounts are provisioned on first use. The user list also registers existing accounts as it loads them. Users can change their password through the account menu.

## Inboxes and delivery

There is one **shared inbox** per installation and one **personal inbox** per account.

- An authenticated upload defaults to the user's personal inbox. Admins can select the shared inbox.
- The root `inbox/` folder receives shared scans. Each personal inbox has its own `inbox/personal-<id>/` folder. The worker watches all registered inbox folders without using authentication or account credentials.
- Identical PDFs in different inboxes remain separate sources. Repeated arrivals within one inbox use the same source.
- Personal documents are delivered to the submitting account. Detected owner names do not share them.
- Shared documents enter **Needs delivery** after filing. Admins check the pages and select recipients under **Document access**. Owner-to-account routing rules suggest recipients; they do not deliver automatically. Unknown or uncertain recipients remain in review until the admin chooses an account.
- Tags and summaries run per document after filing. Delivery does not wait for enrichment. Recipients can see processing progress, correct metadata, verify, and retry document processing.
- Source grouping/OCR review is still scan-wide. Early publication before filing is not part of this flow.

## Permissions

| Operation                                                    | Personal mode                         | Admin mode                                                  |
| ------------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------- |
| Settings and Scans navigation                                | Visible                               | Visible                                                     |
| Read documents, search, counts, PDF                          | Explicitly delivered/shared documents | Same, plus all shared-inbox documents                       |
| Read full sources                                            | Own personal sources                  | Own personal sources and shared sources                     |
| Edit metadata, tags, summary, text; verify; retry enrichment | Visible documents                     | Visible documents                                           |
| Change document owners or pages                              | No                                    | Own/shared sources; page changes also require source access |
| Upload, review source groups, retry/reprocess source         | Own personal inbox                    | Own personal inbox and shared inbox                         |
| Share/revoke document access                                 | Documents from own personal inbox     | Same, plus shared-inbox delivery                            |
| Display preference and password                              | Own account                           | Own account                                                 |
| Catalog, global processing settings, search rebuild          | Read relevant catalog only            | Manage installation                                         |
| Users, roles, routing suggestions, account sessions          | No                                    | Yes                                                         |

Sharing a document never grants access to its original scan or other documents from that scan. The source tab remains visible and explains when source access is restricted. An admin who receives a document from another personal inbox has the same source restriction. Admin status does not grant access to other personal inboxes.

Each admin session starts in personal mode. Switch to Admin mode to manage the shared inbox and installation. Disabling authentication restores full access to all inboxes and files.

## Storage and existing data

The data directory contains:

- `state/inboxes.json`: inbox IDs, account IDs, names, routing owner IDs, and display preferences. Personal inbox IDs are stable hashes of account IDs. The shared inbox ID is `shared`.
- `scans/<id>/scan.json`: immutable `inbox_id` provenance and processing history.
- Document TOML metadata: `inbox_id`, explicit `access_user_ids`, and `delivery_status` (`review` or `delivered`). `owner_ids` is a separate field.
- The existing PDFs, text files, catalog, and processing settings remain in their existing filesystem storage.

Older scans and documents without these fields are treated as shared. With auth enabled, documents without explicit grants are visible to admins and appear in Needs delivery. Old user-to-owner assignments do not grant access. An admin must deliver these documents explicitly. With auth disabled, all existing documents remain accessible; no account migration is required.

The application enforces these permissions. A person with direct server/filesystem access can still read unencrypted files and backups.

## Session and API boundary

Every web request checks the database session, current role, and mode. Each API request checks the current document/source permissions in storage. Cookie session caching is disabled. The web server removes incoming authorization and sends Python its own HS256 identity, with issuer `paperman-web`, audience `paperman-api`, and a 30-second lifetime. Python checks the signature, required claims, issuer, audience, issued time, and expiry. No browser endpoint issues these internal tokens.

Logout, revocation, suspension, and role changes affect the next web request. Explicit document access changes affect the next API request. Owner metadata and routing suggestions do not change existing access. A request already sent to Python may finish within its 30-second token lifetime. Displayed or downloaded content cannot be recalled. Password changes end other sessions; an admin password reset also ends the user's sessions.

The API proxy and server functions use the same identity path. TanStack Start's CSRF middleware protects server functions. Better Auth checks origins on auth routes. Proxy writes require the same origin. Do not cache authenticated responses in a shared proxy.

## Disable

Set `PAPERMAN_AUTH_ENABLED=false` on both services and restart them. The original unrestricted private-instance behavior returns, without login, database access, or secrets. The existing auth database can remain for later use. Do not disable auth on a public instance.

## Checks

```sh
uv --directory apps/server run pytest tests/test_auth.py tests/test_inboxes.py
bun --filter @paperman/web test:auth
```

These checks use isolated data and cover direct API access, personal/shared inbox boundaries, source isolation, explicit delivery, personal/admin modes, edit limits, token expiry, real SQLite sessions, public signup denial, logout, suspension, role changes, and session revocation.

For a live HTTP check, start the web server, API, and demo worker against isolated data. Create two test accounts, then run `node --test apps/web/tests/inbox-http.test.mjs` with `PAPERMAN_INBOX_TEST_URL`, `PAPERMAN_INBOX_TEST_EMAIL`, `PAPERMAN_INBOX_TEST_OTHER_EMAIL`, `PAPERMAN_INBOX_TEST_PASSWORD`, and `PAPERMAN_INBOX_TEST_PDF` set. The check uploads a test PDF, approves its groups, shares one document, checks source restrictions, and revokes access. It also checks server-rendered navigation and preferences. This does not replace a visual UI review.
