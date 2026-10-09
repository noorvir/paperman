import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jwtVerify } from "jose";
import { getAuth } from "../src/lib/auth/auth.server";
import {
  getAccess,
  identityHeaders,
  requireAdmin,
  requireSuperAdmin,
  setGodMode,
} from "../src/lib/auth/session.server";
import { migrateInstallation } from "../src/lib/auth/installation.server";
import { installationId } from "../src/lib/auth/permissions";

function responseHeaders(response: Response) {
  const cookies = new Map<string, string>();
  for (const value of response.headers.getSetCookie()) {
    const cookie = value.split(";")[0];
    cookies.set(cookie.slice(0, cookie.indexOf("=")), cookie);
  }
  return new Headers({
    cookie: [...cookies.values()].join("; "),
    origin: "http://localhost:3199",
  });
}

const directory = mkdtempSync(join(tmpdir(), "paperman-auth-"));
process.env.PAPERMAN_AUTH_ENABLED = "true";
process.env.PAPERMAN_AUTH_DATABASE = join(directory, "auth.sqlite");
process.env.PAPERMAN_AUTH_URL = "http://localhost:3199";
process.env.PAPERMAN_AUTH_SECRET = "test-session-secret-at-least-32-characters";
process.env.PAPERMAN_API_AUTH_SECRET = "test-api-secret-at-least-32-characters";

await test("organization roles and superadmin remain separate across migration, live sessions, and impersonation", async () => {
  const runtime = await getAuth();
  assert.ok(runtime);
  const { auth, db } = runtime;
  const { adapter } = await auth.$context;
  const password = "Test-password-1234";
  async function signIn(email: string) {
    const result = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    assert.equal(result.status, 200);
    return responseHeaders(result);
  }
  try {
    const original = await auth.api.createUser({
      body: {
        email: "root@example.test",
        name: "Root",
        password,
        role: "user",
      },
    });
    const originalAdmin = await auth.api.createUser({
      body: {
        email: "admin@example.test",
        name: "Admin",
        password,
        role: "user",
      },
    });
    for (const user of [original.user, originalAdmin.user]) {
      await adapter.update({
        model: "user",
        where: [{ field: "id", value: user.id }],
        update: { role: "admin" },
      });
    }
    const rootHeaders = await signIn(original.user.email);
    const beforeSession = await auth.api.getSession({ headers: rootHeaders });
    assert.ok(beforeSession);
    await migrateInstallation(runtime, original.user.email);
    await migrateInstallation(runtime, original.user.email);
    assert.equal(
      (await auth.api.getSession({ headers: rootHeaders }))?.session.id,
      beforeSession.session.id,
    );
    assert.deepEqual(await getAccess(rootHeaders), {
      state: "authenticated",
      userId: original.user.id,
      name: "Root",
      applicationRole: "superadmin",
      organizationRole: "admin",
      impersonating: false,
      godMode: false,
    });
    await requireAdmin(rootHeaders);
    await assert.rejects(requireSuperAdmin(rootHeaders), /God mode/);
    await assert.rejects(
      auth.api.listUsers({ headers: rootHeaders, query: {} }),
    );
    const bypass = await auth.handler(
      new Request("http://localhost:3199/api/auth/update-session", {
        method: "POST",
        headers: {
          cookie: rootHeaders.get("cookie")!,
          origin: "http://localhost:3199",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ godMode: true }),
      }),
    );
    assert.ok(bypass.status < 500);
    await assert.rejects(requireSuperAdmin(rootHeaders));
    await setGodMode(rootHeaders, true);
    await requireSuperAdmin(rootHeaders);
    const otherRootSession = await signIn(original.user.email);
    await assert.rejects(requireSuperAdmin(otherRootSession));
    await setGodMode(rootHeaders, false);
    await assert.rejects(
      auth.api.listUsers({ headers: rootHeaders, query: {} }),
    );
    await requireAdmin(rootHeaders);
    await setGodMode(rootHeaders, true);
    const adminHeaders = await signIn(originalAdmin.user.email);
    await assert.rejects(setGodMode(adminHeaders, true));
    await assert.rejects(setGodMode(new Headers(), true));
    await requireAdmin(adminHeaders);
    await assert.rejects(requireSuperAdmin(adminHeaders), /Superadmin/);
    await assert.rejects(
      auth.api.listUsers({ headers: adminHeaders, query: {} }),
    );
    await assert.rejects(
      auth.api.createUser({
        headers: adminHeaders,
        body: {
          email: "forbidden@example.test",
          name: "Forbidden",
          password,
          role: "user",
        },
      }),
    );
    await assert.rejects(
      auth.api.setRole({
        headers: adminHeaders,
        body: { userId: originalAdmin.user.id, role: "superadmin" },
      }),
    );
    const created = await auth.api.createUser({
      headers: rootHeaders,
      body: {
        email: "member@example.test",
        name: "Member",
        password,
        role: "user",
      },
    });
    const memberHeaders = await signIn(created.user.email);
    const memberAccess = await getAccess(memberHeaders);
    assert.ok(memberAccess.state === "authenticated");
    assert.equal(memberAccess.organizationRole, "member");
    await assert.rejects(requireAdmin(memberHeaders));
    await assert.rejects(requireSuperAdmin(memberHeaders));
    const members = await auth.api.listMembers({
      headers: adminHeaders,
      query: { organizationId: installationId },
    });
    assert.equal(members.total, 3);
    const member = members.members.find(
      (item) => item.userId === created.user.id,
    );
    assert.ok(member);
    await assert.rejects(
      auth.api.updateMemberRole({
        headers: memberHeaders,
        body: {
          organizationId: installationId,
          memberId: member.id,
          role: "admin",
        },
      }),
    );
    await auth.api.updateMemberRole({
      headers: adminHeaders,
      body: {
        organizationId: installationId,
        memberId: member.id,
        role: "admin",
      },
    });
    await requireAdmin(memberHeaders);
    await assert.rejects(requireSuperAdmin(memberHeaders));
    await auth.api.updateMemberRole({
      headers: adminHeaders,
      body: {
        organizationId: installationId,
        memberId: member.id,
        role: "member",
      },
    });
    await assert.rejects(requireAdmin(memberHeaders));

    const identity = await identityHeaders(memberHeaders);
    const token = identity?.get("Authorization")?.slice(7);
    assert.ok(token);
    const key = new TextEncoder().encode(process.env.PAPERMAN_API_AUTH_SECRET);
    const signed = await jwtVerify(token, key, {
      issuer: "paperman-web",
      audience: "paperman-api",
    });
    assert.equal(signed.payload.organization_role, "member");
    assert.equal(signed.payload.application_role, "user");
    assert.equal(signed.payload.organization_id, installationId);
    assert.equal(signed.payload.mode, undefined);
    assert.equal(signed.payload.owner_ids, undefined);
    assert.ok(signed.payload.exp && signed.payload.iat);
    assert.equal(signed.payload.exp - signed.payload.iat, 30);
    await assert.rejects(
      jwtVerify(token, key, {
        currentDate: new Date((signed.payload.exp + 1) * 1000),
      }),
    );

    await assert.rejects(
      auth.api.impersonateUser({
        headers: adminHeaders,
        body: { userId: created.user.id },
      }),
    );
    const impersonation = await auth.api.impersonateUser({
      headers: rootHeaders,
      body: { userId: created.user.id },
      asResponse: true,
    });
    assert.equal(impersonation.status, 200);
    const impersonatedHeaders = responseHeaders(impersonation);
    const impersonated = await getAccess(impersonatedHeaders);
    assert.ok(impersonated.state === "authenticated");
    assert.equal(impersonated.userId, created.user.id);
    assert.equal(impersonated.impersonating, true);
    assert.equal(impersonated.godMode, false);
    await assert.rejects(setGodMode(impersonatedHeaders, true));
    await assert.rejects(requireSuperAdmin(impersonatedHeaders));
    await assert.rejects(requireAdmin(impersonatedHeaders));
    const restored = await auth.api.stopImpersonating({
      headers: impersonatedHeaders,
      asResponse: true,
    });
    assert.equal(restored.status, 200);
    const restoredHeaders = responseHeaders(restored);
    await requireSuperAdmin(restoredHeaders);

    const rootMember = members.members.find(
      (item) => item.userId === original.user.id,
    );
    assert.ok(rootMember);
    await auth.api.updateMemberRole({
      headers: adminHeaders,
      body: {
        organizationId: installationId,
        memberId: rootMember.id,
        role: "member",
      },
    });
    await requireSuperAdmin(rootHeaders);
    await assert.rejects(requireAdmin(rootHeaders));
    await auth.api.removeMember({
      headers: adminHeaders,
      body: { organizationId: installationId, memberIdOrEmail: rootMember.id },
    });
    const superOnly = await getAccess(rootHeaders);
    assert.ok(superOnly.state === "authenticated");
    assert.equal(superOnly.organizationRole, null);
    await requireSuperAdmin(rootHeaders);
    await assert.rejects(requireAdmin(rootHeaders));

    await auth.api.banUser({
      headers: rootHeaders,
      body: { userId: created.user.id },
    });
    assert.equal((await getAccess(memberHeaders)).state, "anonymous");
    await auth.api.unbanUser({
      headers: rootHeaders,
      body: { userId: created.user.id },
    });
    const renewed = await signIn(created.user.email);
    const session = await auth.api.getSession({ headers: renewed });
    assert.ok(session);
    await auth.api.revokeUserSession({
      headers: rootHeaders,
      body: { sessionToken: session.session.token },
    });
    assert.equal((await getAccess(renewed)).state, "anonymous");
    const signedIn = await signIn(created.user.email);
    await auth.api.signOut({ headers: signedIn });
    assert.equal((await getAccess(signedIn)).state, "anonymous");
    const signup = await auth.handler(
      new Request("http://localhost:3199/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:3199",
        },
        body: JSON.stringify({
          email: "outsider@example.test",
          name: "Outsider",
          password,
        }),
      }),
    );
    assert.equal(signup.status, 400);
    assert.equal((await getAccess(new Headers())).state, "anonymous");
    assert.equal(await identityHeaders(new Headers()), null);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
