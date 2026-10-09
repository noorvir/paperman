import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.env.PAPERMAN_AUTH_TEST_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
const adminEmail = process.env.PAPERMAN_AUTH_TEST_EMAIL;
const adminPassword = process.env.PAPERMAN_AUTH_TEST_PASSWORD;

test(
  "authenticated UI and proxy enforce personal access and admin actions",
  {
    skip: !base || !browserURL || !adminEmail || !adminPassword,
    timeout: 120000,
  },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
      "Use an isolated local auth instance with synthetic seed data",
    );
    const browser = await chromium.connectOverCDP(browserURL);
    const adminContext = await browser.newContext({
      viewport: { width: 1469, height: 1000 },
    });
    const userContext = await browser.newContext({
      viewport: { width: 1469, height: 1000 },
    });
    const admin = await adminContext.newPage();
    const user = await userContext.newPage();
    const errors = [];
    for (const page of [admin, user]) {
      page.on("pageerror", (error) => errors.push(error.message));
    }
    const email = `access-${Date.now()}@example.test`;
    const password = "Synthetic-member-password-1234";
    async function login(page, email, password) {
      await page.goto(base + "/login");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(base + "/");
    }
    try {
      const anonymous = await userContext.request.get(base + "/api/documents");
      assert.equal(anonymous.status(), 401);
      await login(admin, adminEmail, adminPassword);
      assert.equal(
        (await adminContext.request.get(base + "/api/scans")).status(),
        200,
      );
      await admin
        .getByRole("button", { name: "Administrator", exact: true })
        .click();
      await admin
        .getByRole("menuitem", { name: "Switch to admin mode" })
        .click();
      await admin
        .getByRole("button", { name: "Admin mode", exact: true })
        .waitFor();
      assert.equal(
        (await adminContext.request.get(base + "/api/scans")).status(),
        200,
      );
      await admin.goto(base + "/users");
      await admin.getByLabel("Name", { exact: true }).fill("Access Test User");
      await admin.getByLabel("Email", { exact: true }).fill(email);
      await admin.getByLabel("Initial password").fill(password);
      await admin
        .getByRole("button", { name: "Create user", exact: true })
        .click();
      await admin.getByRole("link", { name: new RegExp(email) }).click();
      await admin.getByText("Linked owners", { exact: true }).waitFor();
      const accountUrl = admin.url();
      await login(user, email, password);
      let result = await userContext.request.get(base + "/api/documents");
      assert.equal((await result.json()).total, 0);
      await admin
        .getByRole("checkbox", { name: "Alex Morgan", exact: true })
        .check();
      await admin.getByRole("button", { name: "Save owners and role" }).click();
      await admin
        .getByRole("button", { name: "Save owners and role" })
        .waitFor({ state: "visible" });
      await admin.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
      );
      result = await userContext.request.get(base + "/api/documents");
      assert.equal((await result.json()).total, 0);
      const all = await (
        await adminContext.request.get(base + "/api/documents")
      ).json();
      const target = all.items.find((doc) => doc.owner_ids.includes("alex"));
      assert.ok(target);
      await admin.goto(`${base}/documents/${target.id}`);
      await admin.getByRole("button", { name: "Deliver", exact: true }).click();
      await admin
        .getByRole("img", { name: `Delivered: ${target.title}`, exact: true })
        .waitFor();
      result = await userContext.request.get(base + "/api/documents");
      const permitted = await result.json();
      assert.deepEqual(
        permitted.items.map((doc) => doc.id),
        [target.id],
      );
      const other = all.items.find((doc) => !doc.owner_ids.includes("alex"));
      assert.ok(other);
      for (const suffix of ["", "/pdf"]) {
        assert.equal(
          (
            await userContext.request.get(
              `${base}/api/documents/${other.id}${suffix}`,
            )
          ).status(),
          404,
        );
      }
      for (const url of ["/api/settings", "/api/auth/admin/list-users"]) {
        assert.equal((await userContext.request.get(base + url)).status(), 403);
      }
      assert.equal(
        (await userContext.request.get(base + "/api/scans")).status(),
        200,
      );
      assert.equal(
        (
          await userContext.request.get(
            `${base}/api/scans/${other.scan_id}/pdf`,
          )
        ).status(),
        404,
      );
      const doc = permitted.items[0];
      await user.goto(`${base}/documents/${doc.id}`);
      await user.getByRole("button", { name: "Edit", exact: true }).waitFor();
      assert.equal(
        await user.getByRole("link", { name: "Source", exact: true }).count(),
        1,
      );
      assert.equal(
        await user
          .getByRole("button", { name: "Reprocess", exact: true })
          .count(),
        1,
      );
      assert.equal(
        (
          await userContext.request.get(`${base}/api/documents/${doc.id}/pdf`)
        ).status(),
        200,
      );
      await user.getByRole("button", { name: "Edit", exact: true }).click();
      await user
        .getByLabel("Title", { exact: true })
        .fill(`Edited ${doc.title}`);
      assert.equal(
        await user
          .getByText("Select all recipients.", { exact: false })
          .count(),
        0,
      );
      assert.equal(
        await user.getByRole("spinbutton", { name: /Position for/ }).count(),
        0,
      );
      await user
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await user.getByRole("button", { name: "Edit", exact: true }).waitFor();
      const saved = await (
        await userContext.request.get(`${base}/api/documents/${doc.id}`)
      ).json();
      assert.deepEqual(saved.document.owner_ids, doc.owner_ids);
      assert.deepEqual(saved.document.source_pages, doc.source_pages);
      assert.equal(saved.document.title, `Edited ${doc.title}`);
      if (!saved.document.verification) {
        await user
          .getByRole("button", { name: "Mark as verified", exact: true })
          .click();
        await user
          .getByRole("button", { name: "Mark as verified", exact: true })
          .waitFor({ state: "hidden" });
        const verified = await (
          await userContext.request.get(`${base}/api/documents/${doc.id}`)
        ).json();
        assert.equal(verified.document.verification.by, "Access Test User");
      }
      await user.goto(base + "/settings");
      await user.getByRole("heading", { name: "Your account" }).waitFor();
      await user.getByRole("heading", { name: "Your inbox" }).waitFor();
      await admin.goto(accountUrl);
      await admin
        .getByRole("checkbox", { name: "Alex Morgan", exact: true })
        .uncheck();
      await admin.getByRole("button", { name: "Save owners and role" }).click();
      await admin.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
      );
      assert.equal(
        (
          await userContext.request.get(`${base}/api/documents/${doc.id}`)
        ).status(),
        404,
      );
      await admin.goto(base + "/users");
      await admin.getByRole("link", { name: new RegExp(email) }).click();
      await admin
        .getByRole("button", { name: "Suspend account", exact: true })
        .click();
      await admin
        .getByRole("button", { name: "Restore account", exact: true })
        .waitFor();
      assert.equal(
        (await userContext.request.get(base + "/api/documents")).status(),
        401,
      );
      await user.goto(base + "/documents");
      await user.waitForURL(base + "/login");
      assert.deepEqual(errors, []);
    } finally {
      await adminContext.close();
      await userContext.close();
      await browser.close();
    }
  },
);
