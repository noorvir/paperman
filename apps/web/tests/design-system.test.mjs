import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
if (
  !baseURL ||
  !browserURL ||
  !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
) {
  throw new Error("Use a local PAPERMAN_WEB_URL and PAPERMAN_BROWSER_URL.");
}

test(
  "status hover keeps its semantic color and verification work is reachable",
  { timeout: 45000 },
  async () => {
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1469, height: 1000 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/", { waitUntil: "networkidle" });
      const response = await context.request.get(
        "/api/dashboard?status=unverified",
      );
      const state = await response.json();
      for (const dark of [false, true]) {
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle("dark", dark),
          dark,
        );
        const processed = page.getByRole("button", { name: /^Processed:/ });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        const before = await processed.evaluate((el) => ({
          color: getComputedStyle(el).color,
          background: getComputedStyle(el).backgroundColor,
        }));
        await processed.hover();
        await page.waitForTimeout(200);
        const hover = await processed.evaluate((el) => ({
          color: getComputedStyle(el).color,
          background: getComputedStyle(el).backgroundColor,
        }));
        assert.equal(hover.color, before.color);
        assert.notEqual(hover.background, before.background);
      }
      await page.getByRole("button", { name: /^Needs verification:/ }).click();
      await page
        .getByRole("heading", { name: "Needs verification", exact: true })
        .waitFor();
      assert.equal(
        await page.locator("#overview-work tbody tr").count(),
        state.pipeline_items.items.length,
      );
      for (const doc of state.unverified_documents) {
        assert.ok(
          await page
            .locator("aside")
            .getByRole("link", {
              name: new RegExp(
                doc.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              ),
            })
            .count(),
        );
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const document = state.unverified_documents[0];
      assert.ok(document, "Use data with an unverified document");
      await page.goto(`/documents/${document.id}`, {
        waitUntil: "networkidle",
      });
      assert.ok(
        (
          await page
            .getByRole("heading", { name: document.title, exact: true })
            .boundingBox()
        ).width > 150,
        "Mobile title must not collapse behind actions",
      );
      await page.goto("/", { waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        390,
      );
    } finally {
      await context.close();
      await browser.close();
    }
  },
);

test(
  "shared buttons retain size and accessible labels during icon and text loading",
  { timeout: 45000 },
  async () => {
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1469, height: 1000 },
    });
    const page = await context.newPage();
    const response = await context.request.get("/api/documents");
    const { items } = await response.json();
    try {
      for (const icon of [false, true]) {
        if (icon) {
          await page.goto(`/documents/${items[0].id}`, {
            waitUntil: "networkidle",
          });
          await page
            .getByRole("button", { name: "Reprocess", exact: true })
            .click();
        } else {
          await page.goto("/settings/tags/new", { waitUntil: "networkidle" });
          await page
            .getByRole("textbox", { name: "Name", exact: true })
            .fill("Temporary test tag");
        }
        const button = icon
          ? page
              .getByRole("dialog")
              .getByRole("button", { name: "Reprocess", exact: true })
          : page.getByRole("button", { name: "Save", exact: true });
        await page.waitForTimeout(300);
        const before = await button.boundingBox();
        const gate = Promise.withResolvers();
        const reject = async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          await gate.promise;
          return route.abort();
        };
        await context.route("**/*", reject);
        await button.click();
        try {
          await button.locator('[data-slot="spinner"]').waitFor();
          const during = await button.boundingBox();
          assert.equal(during.width, before.width);
          assert.equal(during.height, before.height);
          assert.equal(await button.getAttribute("aria-busy"), "true");
          assert.equal(await button.isDisabled(), true);
          assert.equal(
            await button
              .locator('[data-slot="spinner"]')
              .evaluate((el) => getComputedStyle(el).animationName),
            "spin",
          );
          assert.match(
            await button.ariaSnapshot(),
            icon ? /Reprocess/ : /Save/,
          );
        } finally {
          gate.resolve();
        }
        await page.getByText("Action failed", { exact: true }).waitFor();
        await context.unroute("**/*", reject);
      }
    } finally {
      await context.close();
      await browser.close();
    }
  },
);
