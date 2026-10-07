import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
if (!baseURL || !browserURL) {
  throw new Error("Set PAPERMAN_WEB_URL and PAPERMAN_BROWSER_URL.");
}

test(
  "unsaved work is protected across settings, catalog, uploads, and page groups",
  { timeout: 90000 },
  async () => {
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 1034 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const writes = [];
    await context.route("**/*", (route) => {
      if (["GET", "HEAD"].includes(route.request().method()))
        return route.continue();
      writes.push(route.request().method());
      return route.abort();
    });
    try {
      for (const kind of ["owners", "tags"]) {
        const path = `/settings/${kind}/new`;
        await page.goto(path, { waitUntil: "networkidle" });
        await page
          .getByRole("textbox", { name: "Name", exact: true })
          .fill("Unsaved entry");
        await page.getByRole("link", { name: "Cancel", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Discard unsaved changes?" })
          .waitFor();
        await page
          .getByRole("button", { name: "Keep editing", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("textbox", { name: "Name", exact: true })
            .inputValue(),
          "Unsaved entry",
        );
        assert.equal(new URL(page.url()).pathname, path);
        if (kind === "owners") {
          const nativeDialog = page.waitForEvent("dialog");
          const reload = page.reload({ timeout: 5000 }).catch(() => {});
          const dialog = await nativeDialog;
          assert.equal(dialog.type(), "beforeunload");
          await dialog.dismiss();
          await reload;
          assert.equal(
            await page
              .getByRole("textbox", { name: "Name", exact: true })
              .inputValue(),
            "Unsaved entry",
          );
        }
        // Returning every value to its initial state needs no confirmation.
        await page.getByRole("textbox", { name: "Name", exact: true }).fill("");
        await page.getByRole("link", { name: "Cancel", exact: true }).click();
        await page.waitForURL((url) => url.pathname === `/settings/${kind}`);
        assert.equal(await page.getByRole("dialog").count(), 0);
      }
      await page.goto("/settings", { waitUntil: "networkidle" });
      const ocr = page.getByRole("textbox", { name: /OCR languages/ });
      await ocr.fill("unsaved");
      await page.getByRole("link", { name: "PaperMan overview" }).click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page.getByRole("button", { name: "Keep editing" }).click();
      assert.equal(await ocr.inputValue(), "unsaved");
      await page.getByRole("link", { name: "PaperMan overview" }).click();
      await page.getByRole("button", { name: "Discard changes" }).click();
      await page.waitForURL((url) => url.pathname === "/");

      await page.goto("/scans/upload", { waitUntil: "networkidle" });
      await page.getByLabel("PDF scan").setInputFiles({
        name: "unsaved.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n"),
      });
      await page.getByRole("link", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page.getByRole("button", { name: "Discard changes" }).click();
      await page.waitForURL((url) => url.pathname === "/scans");
      const scanId = await page
        .locator("[data-collection-link]")
        .first()
        .getAttribute("data-item-id");
      await page.goto(`/scans/${scanId}/review`, { waitUntil: "networkidle" });
      const feedback = page.getByRole("textbox", {
        name: "Describe changes",
        exact: true,
      });
      await feedback.fill("Unsaved review request");
      await page
        .getByRole("link", { name: "Back to scan", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page.getByRole("button", { name: "Keep editing" }).click();
      await feedback.fill("");
      const title = page.getByRole("textbox", {
        name: "Document 1 title",
        exact: true,
      });
      await title.fill("Unsaved page group");
      await page.getByRole("link", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page.getByRole("button", { name: "Discard changes" }).click();
      await page.waitForURL((url) => url.pathname === `/scans/${scanId}`);
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  },
);

test(
  "save sends all editor tabs and only clears the guard after success",
  { timeout: 45000 },
  async () => {
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 1034 },
    });
    const page = await context.newPage();
    const writes = [];
    let fail = true;
    // Replace the write boundary so this check cannot modify the connected library.
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (["GET", "HEAD"].includes(request.method())) return route.continue();
      writes.push(request.postData() ?? "");
      if (fail)
        return route.fulfill({
          status: 503,
          contentType: "text/plain",
          body: "Test save failure",
        });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: {} }),
      });
    });
    try {
      await page.goto("/documents", { waitUntil: "networkidle" });
      const id = await page
        .locator("[data-collection-link]")
        .first()
        .getAttribute("data-item-id");
      await page.goto(`/documents/${id}?edit=true`, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("textbox", { name: "Title", exact: true })
        .fill("Save boundary title");
      await page.getByRole("tab", { name: "Summary", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Summary", exact: true })
        .fill("Save boundary summary");
      await page.getByRole("tab", { name: "Text", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Extracted text", exact: true })
        .fill("Save boundary text");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await page.getByText("Test save failure", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page
        .getByRole("button", { name: "Keep editing", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Extracted text", exact: true })
          .inputValue(),
        "Save boundary text",
      );
      fail = false;
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await page.waitForURL((url) => !url.searchParams.has("edit"));
      assert.equal(new URL(page.url()).pathname, `/documents/${id}`);
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(writes.length, 2);
      for (const body of writes) {
        for (const value of [
          "Save boundary title",
          "Save boundary summary",
          "Save boundary text",
        ])
          assert.ok(body.includes(value));
      }
    } finally {
      await context.close();
      await browser.close();
    }
  },
);
