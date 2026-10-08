import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
if (!baseURL || !browserURL) {
  throw new Error("Set PAPERMAN_WEB_URL and PAPERMAN_BROWSER_URL.");
}

test("keyboard selection updates the open preview without reopening it", async () => {
  const browser = await chromium.connectOverCDP(browserURL);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1532, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/documents", { waitUntil: "networkidle" });
    const rows = page.locator(".collection-body [data-collection-link]");
    const ids = await rows.evaluateAll((links) =>
      links.map((link) => link.getAttribute("data-item-id")),
    );
    const titles = await rows.evaluateAll((links) =>
      links.map((link) => link.querySelector("span").textContent),
    );
    assert.ok(ids.length >= 3, "Use at least three local documents");
    await rows.first().click();
    const dialog = page.getByRole("dialog", { name: /^Preview:/ });
    await dialog.waitFor();
    const originalPanel = await dialog.elementHandle();
    await originalPanel.evaluate(async (panel) => {
      await Promise.all(
        panel.getAnimations().map((animation) => animation.finished),
      );
    });
    const initialBounds = await dialog.boundingBox();
    const animations = await page.evaluateHandle(() => {
      const state = { openings: 0 };
      document.addEventListener("animationstart", (event) => {
        if (event.animationName === "collection-preview-enter")
          state.openings++;
      });
      return state;
    });
    await rows.first().focus();
    for (const [key, index] of [
      ["ArrowDown", 1],
      ["ArrowDown", 2],
      ["ArrowUp", 1],
      ["ArrowUp", 0],
    ]) {
      await page.keyboard.press(key);
      await page.waitForURL(
        (url) => url.searchParams.get("preview") === ids[index],
      );
      await dialog
        .getByRole("heading", { name: titles[index], exact: true })
        .waitFor();
      const connected = await originalPanel.evaluate(
        (panel) => panel.isConnected,
      );
      assert.equal(
        connected,
        true,
        "The original preview panel must stay mounted",
      );
      const bounds = await dialog.boundingBox();
      assert.deepEqual(bounds, initialBounds);
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-item-id") === id,
        ids[index],
      );
      const focused = await rows
        .nth(index)
        .evaluate((link) => document.activeElement === link);
      assert.equal(focused, true);
    }
    await dialog
      .getByRole("navigation", { name: "Document view" })
      .getByRole("link", { name: "Source", exact: true })
      .click();
    await rows.first().focus();
    for (const index of [1, 2]) {
      await page.keyboard.press("ArrowDown");
      await dialog
        .getByRole("heading", { name: titles[index], exact: true })
        .waitFor();
      const connected = await originalPanel.evaluate(
        (panel) => panel.isConnected,
      );
      assert.equal(connected, true);
      const response = await context.request.get(
        `/api/documents/${ids[index]}`,
      );
      const detail = await response.json();
      await page.waitForFunction(
        (first) =>
          document.querySelector(
            '.document-panel[aria-label="Source scan"] input[aria-label="PDF page number"]',
          )?.value === String(first),
        detail.document.source_pages[0],
      );
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-item-id") === id,
        ids[index],
      );
    }
    const openings = await animations.evaluate((state) => state.openings);
    assert.equal(
      openings,
      0,
      "Keyboard selection must not replay the opening animation",
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
