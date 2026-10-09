import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { getAccess, requireAdmin } from "./session.server";
import { getAuth } from "./auth.server";
import { client, unwrap } from "../api.server";

export const getSessionAccess = createServerFn({ method: "GET" }).handler(() =>
  getAccess(getRequestHeaders()),
);

export const getWorkspace = createServerFn({ method: "GET" }).handler(
  async () => {
    const access = await getAccess(getRequestHeaders());
    if (access.state === "anonymous") {
      return { access, time_format: "24h", demo: false };
    }
    const result = await client.GET("/api/workspace");
    return { access, ...unwrap(result) };
  },
);

export const setMode = createServerFn({ method: "POST" })
  .validator(z.enum(["personal", "admin"]))
  .handler(async ({ data: mode }) => {
    const headers = getRequestHeaders();
    const runtime = await getAuth();
    if (!runtime) {
      throw new Error("Authentication is disabled");
    }
    const session = await runtime.auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    if (!session || session.user.banned || session.user.role !== "admin") {
      throw new Error("An admin account is required");
    }
    runtime.db
      .prepare(
        "INSERT INTO session_mode(session_id, mode) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET mode=excluded.mode",
      )
      .run(session.session.id, mode);
  });

export const saveOwnerAccess = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().min(1),
      ownerIds: z.array(z.string()).max(1000),
    }),
  )
  .handler(async ({ data: { userId, ownerIds } }) => {
    await requireAdmin(getRequestHeaders());
    const runtime = await getAuth();
    if (!runtime) {
      throw new Error("Authentication is disabled");
    }
    const result = await client.GET("/api/catalog");
    const catalog = unwrap(result);
    if (
      !ownerIds.every((id) => catalog.owners.some((owner) => owner.id === id))
    ) {
      throw new Error("Select owners from the catalog");
    }
    if (!runtime.db.prepare("SELECT id FROM user WHERE id = ?").get(userId)) {
      throw new Error("User not found");
    }
    runtime.db.exec("BEGIN IMMEDIATE");
    try {
      runtime.db
        .prepare("DELETE FROM user_owner WHERE user_id = ?")
        .run(userId);
      const insert = runtime.db.prepare(
        "INSERT INTO user_owner(user_id, owner_id) VALUES (?, ?)",
      );
      for (const id of new Set(ownerIds)) {
        insert.run(userId, id);
      }
      runtime.db.exec("COMMIT");
    } catch (error) {
      runtime.db.exec("ROLLBACK");
      throw error;
    }
  });

export const getUsers = createServerFn({ method: "GET" })
  .validator(z.object({ offset: z.number().int().min(0), userId: z.string() }))
  .handler(async ({ data: { offset, userId } }) => {
    const headers = getRequestHeaders();
    await requireAdmin(headers);
    const runtime = await getAuth();
    if (!runtime) {
      throw new Error("Authentication is disabled");
    }
    const users = await runtime.auth.api.listUsers({
      headers,
      query: { limit: 25, offset, sortBy: "createdAt", sortDirection: "desc" },
    });
    let selected = null;
    if (userId) {
      const user = await runtime.auth.api.getUser({
        headers,
        query: { id: userId },
      });
      const sessions = await runtime.auth.api.listUserSessions({
        headers,
        body: { userId },
      });
      const rows = runtime.db
        .prepare("SELECT owner_id FROM user_owner WHERE user_id = ?")
        .all(userId);
      const ownerIds = z
        .array(z.object({ owner_id: z.string() }))
        .parse(rows)
        .map(({ owner_id }) => owner_id);
      selected = { user, sessions: sessions.sessions, ownerIds };
    }
    return { ...users, selected };
  });
