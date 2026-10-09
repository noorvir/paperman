import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAuth } from "../src/lib/auth/auth.server";
import { authConfig } from "../src/lib/auth/config.server";
import { getAccess, identityHeaders } from "../src/lib/auth/session.server";

await test("disabled mode needs neither a database nor secrets, while enabled mode fails closed", async () => {
  const directory = mkdtempSync(join(tmpdir(), "paperman-no-auth-"));
  delete process.env.PAPERMAN_AUTH_ENABLED;
  delete process.env.PAPERMAN_AUTH_SECRET;
  delete process.env.PAPERMAN_API_AUTH_SECRET;
  delete process.env.PAPERMAN_AUTH_URL;
  process.env.PAPERMAN_AUTH_DATABASE = join(directory, "auth.sqlite");
  try {
    assert.equal(await getAuth(), null);
    assert.deepEqual(await getAccess(new Headers()), { state: "disabled" });
    const headers = await identityHeaders(
      new Headers({ authorization: "Bearer untrusted" }),
    );
    assert.ok(headers);
    assert.equal(headers.get("Authorization"), null);
    assert.equal(existsSync(process.env.PAPERMAN_AUTH_DATABASE), false);
    process.env.PAPERMAN_AUTH_ENABLED = "true";
    assert.throws(authConfig);
    process.env.PAPERMAN_AUTH_ENABLED = "typo";
    assert.throws(authConfig);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
