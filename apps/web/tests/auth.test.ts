import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jwtVerify } from "jose";
import { getAuth } from "../src/lib/auth/auth.server";
import { getAccess, identityHeaders } from "../src/lib/auth/session.server";

const directory = mkdtempSync(join(tmpdir(), "paperman-auth-"));
process.env.PAPERMAN_AUTH_ENABLED = "true";
process.env.PAPERMAN_AUTH_DATABASE = join(directory, "auth.sqlite");
process.env.PAPERMAN_AUTH_URL = "http://localhost:3199";
process.env.PAPERMAN_AUTH_SECRET = "test-session-secret-at-least-32-characters";
process.env.PAPERMAN_API_AUTH_SECRET = "test-api-secret-at-least-32-characters";

await test("real SQLite sessions enforce role, mode, revocation and current owner access", async () => {
  const runtime = await getAuth();
  assert.ok(runtime);
  const { auth, db } = runtime;
  try {
    const admin = await auth.api.createUser({
      body: {
        email: "admin@example.test",
        name: "Admin",
        password: "Test-password-1234",
        role: "admin",
      },
    });
    const user = await auth.api.createUser({
      body: {
        email: "user@example.test",
        name: "User",
        password: "Test-password-5678",
        role: "user",
      },
    });
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
          password: "Test-password-1234",
        }),
      }),
    );
    assert.equal(signup.status, 400);
    const anonymous = await getAccess(new Headers());
    assert.equal(anonymous.state, "anonymous");
    assert.equal(await identityHeaders(new Headers()), null);

    async function signIn(email: string, password: string) {
      const result = await auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      assert.equal(result.status, 200);
      const cookie = result.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      return new Headers({ cookie, origin: "http://localhost:3199" });
    }
    const adminHeaders = await signIn(
      "admin@example.test",
      "Test-password-1234",
    );
    assert.deepEqual(await getAccess(adminHeaders), {
      state: "authenticated",
      userId: admin.user.id,
      name: "Admin",
      role: "admin",
      mode: "personal",
      ownerIds: [],
    });
    await assert.rejects(
      auth.api.listUsers({ headers: adminHeaders, query: {} }),
      /Admin mode/,
    );
    const adminSession = await auth.api.getSession({ headers: adminHeaders });
    assert.ok(adminSession);
    db.prepare(
      "INSERT INTO session_mode(session_id, mode) VALUES (?, 'admin')",
    ).run(adminSession.session.id);
    const users = await auth.api.listUsers({
      headers: adminHeaders,
      query: {},
    });
    assert.equal(users.total, 2);
    const headers = await signIn("user@example.test", "Test-password-5678");
    const session = await auth.api.getSession({ headers });
    assert.ok(session);
    db.prepare(
      "INSERT INTO session_mode(session_id, mode) VALUES (?, 'admin')",
    ).run(session.session.id);
    const personal = await getAccess(headers);
    assert.equal(personal.state, "authenticated");
    assert.ok(personal.state === "authenticated");
    assert.equal(personal.mode, "personal");
    await assert.rejects(
      auth.api.listUsers({ headers, query: {} }),
      /Admin mode/,
    );

    db.prepare("INSERT INTO user_owner(user_id, owner_id) VALUES (?, ?)").run(
      user.user.id,
      "alice",
    );
    const identity = await identityHeaders(headers);
    assert.ok(identity);
    const token = identity.get("Authorization")?.slice(7);
    assert.ok(token);
    const key = new TextEncoder().encode(process.env.PAPERMAN_API_AUTH_SECRET);
    const signed = await jwtVerify(token, key, {
      issuer: "paperman-web",
      audience: "paperman-api",
    });
    assert.deepEqual(signed.payload.owner_ids, ["alice"]);
    assert.ok(signed.payload.exp && signed.payload.iat);
    assert.equal(signed.payload.exp - signed.payload.iat, 30);
    db.prepare("DELETE FROM user_owner WHERE user_id = ?").run(user.user.id);
    const changed = await getAccess(headers);
    assert.ok(changed.state === "authenticated");
    assert.deepEqual(changed.ownerIds, []);

    await auth.api.banUser({
      headers: adminHeaders,
      body: { userId: user.user.id, banReason: "Test suspension" },
    });
    assert.equal((await getAccess(headers)).state, "anonymous");
    assert.equal(await identityHeaders(headers), null);
    // Already-issued internal tokens expire after 30 seconds; they are never a browser login method.
    await assert.rejects(
      jwtVerify(token, key, {
        issuer: "paperman-web",
        audience: "paperman-api",
        currentDate: new Date((signed.payload.exp + 1) * 1000),
      }),
    );
    await auth.api.unbanUser({
      headers: adminHeaders,
      body: { userId: user.user.id },
    });
    const restored = await signIn("user@example.test", "Test-password-5678");
    const restoredSession = await auth.api.getSession({ headers: restored });
    assert.ok(restoredSession);
    await auth.api.revokeUserSession({
      headers: adminHeaders,
      body: { sessionToken: restoredSession.session.token },
    });
    assert.equal((await getAccess(restored)).state, "anonymous");
    const signedIn = await signIn("user@example.test", "Test-password-5678");
    await auth.api.signOut({ headers: signedIn });
    assert.equal((await getAccess(signedIn)).state, "anonymous");

    await auth.api.setRole({
      headers: adminHeaders,
      body: { userId: admin.user.id, role: "user" },
    });
    const demoted = await getAccess(adminHeaders);
    assert.ok(demoted.state === "authenticated");
    assert.equal(demoted.mode, "personal");
    assert.equal(demoted.role, "user");
    await assert.rejects(
      auth.api.listUsers({ headers: adminHeaders, query: {} }),
      /Admin mode/,
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
