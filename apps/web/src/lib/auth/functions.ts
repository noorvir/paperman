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

export const saveRoutingOwners = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().min(1),
      ownerIds: z.array(z.string()).max(1000),
    }),
  )
  .handler(async ({ data: { userId, ownerIds } }) => {
    await requireAdmin(getRequestHeaders());
    const result = await client.GET("/api/inboxes");
    const inboxes = unwrap(result);
    const inbox = inboxes.find((item) => item.account_id === userId);
    if (!inbox) {
      throw new Error("Personal inbox not found");
    }
    const saved = await client.PUT("/api/inboxes/{inbox_id}/routing", {
      params: { path: { inbox_id: inbox.id } },
      body: { owner_ids: ownerIds },
    });
    return unwrap(saved);
  });

export const createAccount = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(1).max(120),
      email: z.email(),
      password: z.string().min(12),
    }),
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireAdmin(headers);
    const runtime = await getAuth();
    if (!runtime) {
      throw new Error("Authentication is disabled");
    }
    const result = await runtime.auth.api.createUser({
      headers,
      body: { ...data, role: "user" },
    });
    try {
      const registered = await client.PUT("/api/inboxes/accounts", {
        body: [{ account_id: result.user.id, name: result.user.name }],
      });
      unwrap(registered);
    } catch {
      throw new Error(
        "The account was created, but its inbox could not be set up. Reload Users to finish setup.",
      );
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
    const selectedUser = userId
      ? await runtime.auth.api.getUser({ headers, query: { id: userId } })
      : null;
    const accounts = users.users.map((user) => ({
      account_id: user.id,
      name: user.name,
    }));
    if (selectedUser && !accounts.some((item) => item.account_id === userId)) {
      accounts.push({ account_id: selectedUser.id, name: selectedUser.name });
    }
    const registered = await client.PUT("/api/inboxes/accounts", {
      body: accounts,
    });
    const inboxes = unwrap(registered);
    let selected = null;
    if (selectedUser) {
      const sessions = await runtime.auth.api.listUserSessions({
        headers,
        body: { userId },
      });
      const inbox = inboxes.find((item) => item.account_id === userId);
      const ownerIds = inbox?.routing_owner_ids ?? [];
      selected = { user: selectedUser, sessions: sessions.sessions, ownerIds };
    }
    return { ...users, selected };
  });
