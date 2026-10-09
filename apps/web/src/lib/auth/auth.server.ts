import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { authConfig } from "./config.server";

let runtime: ReturnType<typeof initialize> | undefined;

export function getAuth() {
  runtime ??= initialize();
  return runtime;
}

async function initialize() {
  const config = authConfig();
  if (!config) {
    return null;
  }
  mkdirSync(dirname(config.database), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(config.database);
  chmodSync(config.database, 0o600);
  db.exec(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
  );
  const options = {
    appName: "PaperMan",
    baseURL: config.url,
    secret: config.secret,
    database: db,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    session: { cookieCache: { enabled: false } },
    plugins: [admin()],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path.startsWith("/admin/") || (!ctx.request && !ctx.headers)) {
          return;
        }
        const session = await getAuthoritativeSessionFromCtx(ctx);
        const mode =
          session &&
          db
            .prepare("SELECT mode FROM session_mode WHERE session_id = ?")
            .get(session.session.id);
        if (
          !session ||
          session.user.role !== "admin" ||
          session.user.banned ||
          mode?.mode !== "admin"
        ) {
          throw new APIError("FORBIDDEN", {
            message: "Admin mode is required",
          });
        }
      }),
    },
  } satisfies BetterAuthOptions;
  const migrations = await getMigrations(options);
  await migrations.runMigrations();
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_mode (
      session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('personal', 'admin'))
    );
  `);
  const auth = betterAuth(options);
  await auth.$context;
  return { auth, db, config };
}
