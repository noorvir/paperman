import { SignJWT } from "jose";
import { z } from "zod";
import { getAuth } from "./auth.server";
import { canAdmin, canSuperAdmin, type Access } from "./access";
import { installationId } from "./permissions";

export async function getAccess(headers: Headers): Promise<Access> {
  const runtime = await getAuth();
  if (!runtime) return { state: "disabled" };
  const session = await runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!session || session.user.banned) return { state: "anonymous" };
  const { adapter } = await runtime.auth.$context;
  const membership = z
    .object({ role: z.enum(["member", "admin"]) })
    .nullable()
    .parse(
      await adapter.findOne({
        model: "member",
        where: [
          { field: "organizationId", value: installationId },
          { field: "userId", value: session.user.id },
        ],
      }),
    );
  return {
    state: "authenticated",
    userId: session.user.id,
    name: session.user.name,
    applicationRole: session.user.role === "superadmin" ? "superadmin" : "user",
    organizationRole: membership?.role ?? null,
    impersonating: Boolean(session.session.impersonatedBy),
    godMode:
      session.user.role === "superadmin" &&
      session.session.godMode === true &&
      !session.session.impersonatedBy,
  };
}

export async function identityHeaders(headers: Headers) {
  const access = await getAccess(headers);
  if (access.state === "anonymous") return null;
  const result = new Headers();
  if (access.state === "disabled") return result;
  const runtime = await getAuth();
  if (!runtime) throw new Error("Authentication configuration changed");
  const token = await new SignJWT({
    name: access.name,
    application_role: canSuperAdmin(access) ? "superadmin" : "user",
    organization_id: access.organizationRole ? installationId : null,
    organization_role: access.organizationRole,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(access.userId)
    .setIssuer("paperman-web")
    .setAudience("paperman-api")
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(new TextEncoder().encode(runtime.config.apiSecret));
  result.set("Authorization", `Bearer ${token}`);
  return result;
}

export async function requireAdmin(headers: Headers) {
  const access = await getAccess(headers);
  if (access.state !== "authenticated" || !canAdmin(access)) {
    throw new Error("Organization admin access is required");
  }
  return access;
}

export async function requireSuperAdmin(headers: Headers) {
  const access = await getAccess(headers);
  if (!canSuperAdmin(access))
    throw new Error("Superadmin access with God mode is required");
  return access;
}

export async function setGodMode(headers: Headers, enabled: boolean) {
  const runtime = await getAuth();
  if (!runtime) throw new Error("Authentication is disabled");
  const session = await runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (
    !session ||
    session.user.banned ||
    session.user.role !== "superadmin" ||
    session.session.impersonatedBy
  ) {
    throw new Error("Only a superadmin can change God mode");
  }
  const { internalAdapter } = await runtime.auth.$context;
  await internalAdapter.updateSession(session.session.token, {
    godMode: enabled,
  });
}
