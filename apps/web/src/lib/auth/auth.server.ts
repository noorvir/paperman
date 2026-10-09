import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { z } from "zod";
import { admin, organization } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { authConfig } from "./config.server";
import { accountRoles, installationId, organizationRoles } from "./permissions";

let runtime: ReturnType<typeof initialize> | undefined;

export function getAuth() {
  runtime ??= initialize();
  return runtime;
}

async function initialize() {
  const config = authConfig();
  if (!config) return null;
  mkdirSync(dirname(config.database), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(config.database);
  chmodSync(config.database, 0o600);
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
    session: {
      cookieCache: { enabled: false },
      additionalFields: {
        godMode: { type: "boolean", defaultValue: false, input: false },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          !ctx.path.startsWith("/admin/") ||
          ctx.path === "/admin/stop-impersonating" ||
          (!ctx.request && !ctx.headers)
        )
          return;
        const session = await getSessionFromCtx(ctx, {
          disableCookieCache: true,
        });
        const mode = z
          .object({ godMode: z.boolean() })
          .safeParse(session?.session);
        if (
          session?.user.role !== "superadmin" ||
          !mode.success ||
          !mode.data.godMode ||
          session.session.impersonatedBy
        ) {
          throw new APIError("FORBIDDEN", {
            message: "Turn on God mode to manage accounts",
          });
        }
      }),
    },
    plugins: [
      admin({ roles: accountRoles, adminRoles: ["superadmin"] }),
      organization({
        roles: organizationRoles,
        creatorRole: "admin",
        allowUserToCreateOrganization: false,
        organizationHooks: {
          beforeUpdateMemberRole: async ({ newRole }) => {
            if (newRole !== "admin" && newRole !== "member") {
              throw new APIError("BAD_REQUEST", {
                message: "Select Admin or Member",
              });
            }
          },
          beforeAddMember: async ({ member }) => {
            if (member.role !== "admin" && member.role !== "member") {
              throw new APIError("BAD_REQUEST", {
                message: "Select Admin or Member",
              });
            }
          },
          beforeDeleteOrganization: async () => {
            throw new APIError("FORBIDDEN", {
              message: "The installation organization cannot be deleted",
            });
          },
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            if (!ctx) return;
            const installation = await ctx.context.adapter.findOne({
              model: "organization",
              where: [{ field: "id", value: installationId }],
            });
            if (installation) {
              await ctx.context.adapter.create({
                model: "member",
                data: {
                  organizationId: installationId,
                  userId: user.id,
                  role: "member",
                  createdAt: new Date(),
                },
              });
            }
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
  const migrations = await getMigrations(options);
  await migrations.runMigrations();
  const auth = betterAuth(options);
  await auth.$context;
  return { auth, db, config };
}
