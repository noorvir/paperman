import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  getAccess,
  requireAdmin,
  requireSuperAdmin,
  setGodMode,
} from "./session.server";
import { getAuth } from "./auth.server";
import { installationId } from "./permissions";
import { client, unwrap } from "../api.server";

export const getSessionAccess = createServerFn({ method: "GET" }).handler(() =>
  getAccess(getRequestHeaders()),
);

export const changeGodMode = createServerFn({ method: "POST" })
  .validator(z.boolean())
  .handler(({ data }) => setGodMode(getRequestHeaders(), data));

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
    await requireSuperAdmin(headers);
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
        "The account was created, but its inbox could not be set up. Open Members to finish setup.",
      );
    }
  });

export const getUsers = createServerFn({ method: "GET" })
  .validator(z.object({ offset: z.number().int().min(0), userId: z.string() }))
  .handler(async ({ data: { offset, userId } }) => {
    const headers = getRequestHeaders();
    await requireSuperAdmin(headers);
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
    let selected = null;
    if (selectedUser) {
      const sessions = await runtime.auth.api.listUserSessions({
        headers,
        body: { userId },
      });
      selected = { user: selectedUser, sessions: sessions.sessions };
    }
    return { ...users, selected };
  });

export const getMembers = createServerFn({ method: "GET" })
  .validator(z.object({ offset: z.number().int().min(0), userId: z.string() }))
  .handler(async ({ data: { offset, userId } }) => {
    const headers = getRequestHeaders();
    await requireAdmin(headers);
    const runtime = await getAuth();
    if (!runtime) throw new Error("Authentication is disabled");
    const members = await runtime.auth.api.listMembers({
      headers,
      query: {
        organizationId: installationId,
        limit: 25,
        offset,
      },
    });
    const selected = userId
      ? await runtime.auth.api.listMembers({
          headers,
          query: {
            organizationId: installationId,
            filterField: "userId",
            filterValue: userId,
            limit: 1,
          },
        })
      : null;
    const member = selected?.members[0] ?? null;
    const accounts = members.members.map((item) => ({
      account_id: item.userId,
      name: item.user.name,
    }));
    if (member && !accounts.some((item) => item.account_id === member.userId)) {
      accounts.push({ account_id: member.userId, name: member.user.name });
    }
    const registered = unwrap(
      await client.PUT("/api/inboxes/accounts", { body: accounts }),
    );
    return {
      ...members,
      selected: member
        ? {
            member,
            ownerIds:
              registered.find((item) => item.account_id === member.userId)
                ?.routing_owner_ids ?? [],
          }
        : null,
    };
  });

export const saveMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      memberId: z.string().min(1),
      role: z.enum(["member", "admin"]),
      ownerIds: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    await requireAdmin(headers);
    const runtime = await getAuth();
    if (!runtime) throw new Error("Authentication is disabled");
    const found = await runtime.auth.api.listMembers({
      headers,
      query: {
        organizationId: installationId,
        filterField: "id",
        filterValue: data.memberId,
        limit: 1,
      },
    });
    const member = found.members[0];
    if (!member) throw new Error("Organization member not found");
    await saveRoutingOwners({
      data: { userId: member.userId, ownerIds: data.ownerIds },
    });
    await runtime.auth.api.updateMemberRole({
      headers,
      body: {
        organizationId: installationId,
        memberId: member.id,
        role: data.role,
      },
    });
  });
