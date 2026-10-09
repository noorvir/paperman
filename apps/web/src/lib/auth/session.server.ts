import { SignJWT } from "jose";
import { getAuth } from "./auth.server";
import { canAdmin, type Access } from "./access";

export async function getAccess(headers: Headers): Promise<Access> {
  const runtime = await getAuth();
  if (!runtime) {
    return { state: "disabled" };
  }
  const session = await runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!session || session.user.banned) {
    return { state: "anonymous" };
  }
  const role = session.user.role === "admin" ? "admin" : "user";
  const storedMode = runtime.db
    .prepare("SELECT mode FROM session_mode WHERE session_id = ?")
    .get(session.session.id);
  const mode =
    role === "admin" && storedMode?.mode === "admin" ? "admin" : "personal";
  return {
    state: "authenticated",
    userId: session.user.id,
    name: session.user.name,
    role,
    mode,
  };
}

export async function identityHeaders(headers: Headers) {
  const access = await getAccess(headers);
  if (access.state === "anonymous") {
    return null;
  }
  const result = new Headers();
  if (access.state === "disabled") {
    return result;
  }
  const runtime = await getAuth();
  if (!runtime) {
    throw new Error("Authentication configuration changed");
  }
  const token = await new SignJWT({
    name: access.name,
    role: access.role,
    mode: access.mode,
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
    throw new Error("Admin mode is required");
  }
  return access;
}
