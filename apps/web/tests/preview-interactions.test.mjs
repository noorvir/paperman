import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
if (!baseURL || !browserURL) throw new Error("Set browser and web URLs.");

test("previews close on outside clicks, keep row navigation, and link titles to full views", async () => {
  const browser = await chromium.connectOverCDP(browserURL);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1532, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    for (const path of ["/documents", "/scans"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const rows = page.locator(".collection-body [data-collection-row]");
      const links = rows.locator("[data-collection-link]");
      assert.ok((await rows.count()) >= 2);
      const dialog = page.getByRole("dialog", { name: /^Preview:/ });
      await links.first().click();
      await dialog.waitFor();
      const panel = await dialog.elementHandle();
      await page
        .getByRole("heading", {
          name: path === "/documents" ? "Documents" : "Scans",
          exact: true,
        })
        .click();
      await dialog.waitFor({ state: "detached" });
      await links.first().click();
      await dialog.waitFor();
      const initial = await dialog.elementHandle();
      // A date/caption cell is also a row click, not an outside dismissal.
      await rows
        .nth(1)
        .locator("td")
        .first()
        .click({ position: { x: 4, y: 4 } });
      const secondId = await links.nth(1).getAttribute("data-item-id");
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(`[data-item-id="${id}"]`)
            ?.getAttribute("aria-expanded") === "true",
        secondId,
      );
      assert.equal(await initial.evaluate((node) => node.isConnected), true);
      assert.equal(await panel.evaluate((node) => node.isConnected), false);
      if (path === "/documents") {
        assert.equal(
          await dialog
            .getByRole("button", { name: "Mark as verified", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await dialog
            .getByRole("button", { name: "View in context", exact: true })
            .count(),
          0,
        );
        await dialog
          .getByRole("link", { name: /^(Verified|Not verified)$/ })
          .waitFor();
      }
      const title = dialog.getByRole("heading", { level: 1 }).getByRole("link");
      const destination = await title.getAttribute("href");
      await title.hover();
      assert.ok(
        (
          await title.evaluate(
            (node) => getComputedStyle(node).textDecorationLine,
          )
        ).includes("underline"),
      );
      if (path === "/documents") {
        const previewURL = page.url();
        const badge = dialog.getByRole("link", {
          name: /^(Verified|Not verified)$/,
        });
        assert.equal(await badge.getAttribute("href"), destination);
        await badge.click();
        await page.waitForURL(new URL(destination, baseURL).href);
        await dialog.waitFor({ state: "detached" });
        await page.goto(previewURL, { waitUntil: "networkidle" });
      }
      await title.click();
      await page.waitForURL(new URL(destination, baseURL).href);
      await dialog.waitFor({ state: "detached" });
      await page.goto(path, { waitUntil: "networkidle" });
      await links.first().click();
      await dialog.waitFor();
      const search = page.getByRole("textbox", {
        name: path === "/documents" ? "Search documents" : "Search scans",
      });
      await search.click();
      await dialog.waitFor({ state: "detached" });
      assert.equal(
        await search.evaluate((node) => node === document.activeElement),
        true,
      );
      await links.first().click();
      await dialog.waitFor();
      await page
        .locator(".collection-body:visible")
        .click({ position: { x: 10, y: 500 } });
      await dialog.waitFor({ state: "detached" });
      await links.first().click();
      await dialog.waitFor();
      await links.first().click();
      await dialog.waitFor({ state: "detached" });
      assert.ok(new URL(page.url()).pathname.startsWith(`${path}/`));
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
