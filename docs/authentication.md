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

Better Auth migrations run before auth requests are served. User-to-owner assignments and session mode have separate tables in the same database. Owner IDs reference the existing catalog; the catalog stays in document storage. Back up the database and auth secret separately from documents. Use SQLite's backup facility or stop the web service before copying the database and its WAL files.

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

Sign in, select **Switch to admin mode**, then **Manage users**. Create accounts, change roles, assign owners, suspend accounts, reset passwords, and end sessions there. New accounts have no owner access. Users can change their password through the account menu.

## Permissions

| Operation                                               | Personal mode                    | Admin mode    |
| ------------------------------------------------------- | -------------------------------- | ------------- |
| Lists, search, counts, detail, PDF/download             | Documents with an assigned owner | All documents |
| Title, date, summary, text, existing tags, verification | Visible documents                | All documents |
| Change owners or pages; rotate pages                    | No                               | Yes           |
| Create/change catalog entries                           | No                               | Yes           |
| Source scans, uploads, review, reprocessing             | No                               | Yes           |
| Global settings, index rebuild                          | No                               | Yes           |
| Users, roles, owner access, sessions                    | No                               | Yes           |

A document is visible if at least one owner matches. This does not grant access to other documents for its other owners. The catalog includes names needed to display visible shared documents. Verification uses the signed-in user's name.

Each new admin session starts in personal mode. The server stores the mode and checks the current admin role on every request. No assigned owners means no visible documents in personal mode.

## Session and API boundary

Every web request checks the database session and current assignments. Cookie session caching is disabled. The web server removes incoming authorization and sends Python its own HS256 identity, with issuer `paperman-web`, audience `paperman-api`, and a 30-second lifetime. Python checks the signature, required claims, issuer, audience, issued time, and expiry. No browser endpoint issues these internal tokens.

Logout, revocation, suspension, role changes, and owner changes affect the next web request. A request already sent to Python may finish within its 30-second token lifetime. Displayed or downloaded content cannot be recalled. Password changes end other sessions; an admin password reset also ends the user's sessions.

The API proxy and server functions use the same identity path. TanStack Start's CSRF middleware protects server functions. Better Auth checks origins on auth routes. Proxy writes require the same origin. Do not cache authenticated responses in a shared proxy.

## Disable

Set `PAPERMAN_AUTH_ENABLED=false` on both services and restart them. The original unrestricted private-instance behavior returns, without login, database access, or secrets. The existing auth database can remain for later use. Do not disable auth on a public instance.

## Checks

```sh
uv --directory apps/server run pytest tests/test_auth.py
bun --filter @paperman/web test:auth
```

These checks use isolated data and cover direct API access, owner boundaries, personal/admin modes, edit limits, token expiry, real SQLite sessions, public signup denial, logout, suspension, role changes, and session revocation.
