import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
if (!baseURL || !browserURL) {
  throw new Error("Set PAPERMAN_WEB_URL and PAPERMAN_BROWSER_URL.");
}

test("PDF context keeps the current tab and details, with independent page positions", async () => {
  const browser = await chromium.connectOverCDP(browserURL);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1532, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const response = await context.request.get("/api/documents");
    const result = await response.json();
    const doc = result.items.find((item) => item.source_pages[0] > 1);
    assert.ok(doc, "Use a document from later source pages");
    {
      const path = `/documents/${doc.id}`;
      await page.goto(path, { waitUntil: "networkidle" });
      const originalURL = page.url();
      const tabs = page.getByRole("navigation", { name: "Document view" });
      const controls = page.getByRole("group", { name: "PDF view options" });
      const input = page.getByRole("textbox", { name: "PDF page number" });
      await input.fill("2");
      await input.press("Enter");
      await controls
        .getByRole("button", { name: "View in context", exact: true })
        .click();
      const scan = page.getByRole("group", {
        name: "Document in source scan",
        exact: true,
      });
      await scan.locator('.pdf-preview[aria-busy="false"]').waitFor();
      await page.waitForFunction(
        (first) =>
          document.querySelector('[aria-label="Document in source scan"] input')
            ?.value === String(first),
        doc.source_pages[0],
      );
      assert.equal(page.url(), originalURL);
      assert.equal(
        await tabs
          .getByRole("link", { name: "PDF", exact: true })
          .getAttribute("aria-current"),
        "page",
      );
      assert.equal(
        await controls
          .getByRole("button", { name: "View in context", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await scan
          .locator(`[data-page-number="${doc.source_pages[0]}"]`)
          .getAttribute("data-included"),
        "true",
      );
      if (!path.includes("preview=")) {
        await page
          .locator(".detail-sidebar")
          .getByText("Tags", { exact: true })
          .waitFor();
      }
      await input.fill("1");
      await input.press("Enter");
      const dimmed = scan.locator('[data-page-number="1"]');
      await dimmed.waitFor();
      assert.equal(
        await dimmed.evaluate((el) => getComputedStyle(el).opacity),
        "0.25",
      );
      await controls
        .getByRole("button", { name: "View in context", exact: true })
        .click();
      assert.equal(await input.inputValue(), "2");
      assert.equal(
        await controls
          .getByRole("button", { name: "View in context", exact: true })
          .getAttribute("aria-pressed"),
        "false",
      );
      await tabs.getByRole("link", { name: "Source", exact: true }).click();
      await page
        .locator(
          '.document-panel[aria-label="Source scan"] .pdf-preview[aria-busy="false"]',
        )
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "View in context", exact: true })
          .count(),
        0,
      );
      await tabs.getByRole("link", { name: "PDF", exact: true }).click();
      await controls
        .getByRole("button", { name: "View in context", exact: true })
        .click();
      assert.equal(await input.inputValue(), "1");
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "View in context", exact: true })
          .count(),
        0,
      );
      await page.setViewportSize({ width: 1532, height: 1000 });
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
