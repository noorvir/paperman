import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
if (!baseURL || !browserURL) {
  throw new Error(
    "Set PAPERMAN_WEB_URL and PAPERMAN_BROWSER_URL. Use an app with at least one document and a Chrome debug session.",
  );
}

let browser;
before(async () => {
  browser = await chromium.connectOverCDP(browserURL);
});
after(async () => {
  await browser?.close();
});

test(
  "document previews, split editing, and draft cancellation",
  { timeout: 90000 },
  async () => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 1034 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/documents?sort=title", { waitUntil: "networkidle" });
      const row = page.locator("[data-collection-link]").first();
      const id = await row.getAttribute("data-item-id");
      assert.ok(id, "The test needs at least one document");
      const fullPath = `/documents/${id}`;

      await row.click();
      await page.getByRole("dialog", { name: /^Preview:/ }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/documents");
      assert.equal(new URL(page.url()).searchParams.get("preview"), id);
      await page
        .getByRole("navigation", { name: "Document view" })
        .getByRole("link", { name: "Summary", exact: true })
        .click();
      await page.waitForURL(
        (url) => url.searchParams.get("view") === "summary",
      );
      assert.equal(new URL(page.url()).pathname, "/documents");
      await page.keyboard.press("Escape");
      await page.waitForURL((url) => !url.searchParams.has("preview"));
      assert.equal(new URL(page.url()).pathname, "/documents");
      assert.equal(new URL(page.url()).searchParams.get("sort"), "title");

      await row.click();
      await page.getByRole("dialog", { name: /^Preview:/ }).waitFor();
      await row.click();
      await page.waitForURL((url) => url.pathname === fullPath);
      await page.locator('.pdf-preview[aria-busy="false"]').waitFor();
      const pdf = await page.locator(".pdf-preview").elementHandle();
      const pdfBefore = await page.locator(".pdf-preview").boundingBox();
      const sidebarBefore = await page.getByRole("complementary").boundingBox();
      const header = await page
        .locator('[data-slot="collection-header"]')
        .boundingBox();
      const tabs = await page
        .getByRole("navigation", { name: "Document view" })
        .boundingBox();
      assert.equal(
        tabs.width,
        header.width,
        "Tabs must span the complete header",
      );
      assert.ok(
        sidebarBefore.y >= header.y + header.height,
        "The sidebar must begin below the header",
      );
      assert.ok(
        pdfBefore.y >= header.y + header.height,
        "The PDF must begin below the header",
      );
      const fullURL = page.url();
      await page.keyboard.press("Escape");
      assert.equal(page.url(), fullURL);
      assert.equal(await page.getByRole("dialog").count(), 0);

      const firstEditFrame = page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              observer.disconnect();
              reject(new Error("Edit did not open"));
            }, 5000);
            const observer = new MutationObserver(() => {
              if (!document.querySelector('form[aria-label="Edit document"]'))
                return;
              observer.disconnect();
              requestAnimationFrame(() => {
                clearTimeout(timeout);
                const buttons = document.querySelectorAll(
                  '[data-slot="collection-header"] button',
                );
                resolve(
                  [...buttons]
                    .filter(
                      (button) =>
                        ["Edit", "Reprocess"].includes(
                          button.textContent.trim(),
                        ) && getComputedStyle(button).visibility === "visible",
                    )
                    .map((button) => button.textContent.trim()),
                );
              });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          }),
      );
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      assert.deepEqual(
        await firstEditFrame,
        [],
        "Both actions must be hidden in the first edit frame",
      );
      await page
        .getByRole("form", { name: "Edit document", exact: true })
        .waitFor();
      const columns = await page
        .locator(".detail-view-layout")
        .evaluate((element) =>
          getComputedStyle(element)
            .gridTemplateColumns.split(" ")
            .map(parseFloat),
        );
      assert.equal(columns.length, 2);
      assert.ok(
        Math.abs(columns[0] - columns[1]) < 1,
        "The editor must use equal columns",
      );
      assert.equal(await page.getByRole("complementary").count(), 0);
      const editor = page.getByRole("region", { name: "Document editor" });
      const editorBox = await editor.boundingBox();
      const editTabs = await page
        .getByRole("tablist", { name: "Edit document sections" })
        .boundingBox();
      assert.ok(
        editTabs.x >= editorBox.x,
        "Edit tabs belong to the right pane",
      );
      assert.ok(
        await pdf.evaluate((element) => element.isConnected),
        "Edit must keep the PDF mounted",
      );
      await page
        .getByRole("button", { name: "Search PDF", exact: true })
        .click();
      await page.getByRole("textbox", { name: "Find in PDF" }).waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("textbox", { name: "Find in PDF" })
        .waitFor({ state: "hidden" });
      assert.equal(new URL(page.url()).searchParams.get("edit"), "true");
      const title = await page
        .getByLabel("Title", { exact: true })
        .inputValue();
      await page
        .getByLabel("Title", { exact: true })
        .fill("Unsaved navigation test");
      await page.getByRole("tab", { name: "Summary", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Summary", exact: true })
        .fill("Unsaved summary test");
      const summaryBox = await page
        .getByRole("textbox", { name: "Summary", exact: true })
        .boundingBox();
      assert.ok(
        summaryBox.height > 500,
        "Summary must use the remaining pane height",
      );
      await page.getByRole("tab", { name: "Text", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Extracted text", exact: true })
        .fill("Unsaved text test");
      const editPdf = await page.locator(".pdf-preview").boundingBox();
      await page.getByRole("tab", { name: "Details", exact: true }).click();
      assert.equal(
        await page.getByLabel("Title", { exact: true }).inputValue(),
        "Unsaved navigation test",
      );
      await page.getByRole("tab", { name: "Summary", exact: true }).click();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Summary", exact: true })
          .inputValue(),
        "Unsaved summary test",
      );
      await page.getByRole("tab", { name: "Text", exact: true }).click();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Extracted text", exact: true })
          .inputValue(),
        "Unsaved text test",
      );
      assert.deepEqual(
        await page.locator(".pdf-preview").boundingBox(),
        editPdf,
      );
      await page.getByRole("tab", { name: "Details", exact: true }).click();
      await page
        .getByRole("button", { name: "Issue date", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Issue date" }).waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("dialog", { name: "Issue date" })
        .waitFor({ state: "hidden" });
      assert.equal(new URL(page.url()).searchParams.get("edit"), "true");
      await page.keyboard.press("Escape");
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page
        .getByRole("button", { name: "Keep editing", exact: true })
        .click();
      assert.equal(new URL(page.url()).searchParams.get("edit"), "true");
      assert.equal(
        await page.getByLabel("Title", { exact: true }).inputValue(),
        "Unsaved navigation test",
      );
      await page
        .getByRole("button", { name: "Edit pages", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor({ state: "hidden" });
      assert.equal(new URL(page.url()).searchParams.get("edit"), "true");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", { name: "Discard changes", exact: true })
        .click();
      await page.waitForURL((url) => !url.searchParams.has("edit"));
      assert.equal(new URL(page.url()).pathname, fullPath);
      assert.deepEqual(
        await page.locator(".pdf-preview").boundingBox(),
        pdfBefore,
      );

      await page.getByRole("button", { name: "Edit", exact: true }).click();
      assert.equal(
        await page.getByLabel("Title", { exact: true }).inputValue(),
        title,
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.waitForURL((url) => !url.searchParams.has("edit"));
      assert.equal(new URL(page.url()).pathname, fullPath);

      await page.goto(`${fullPath}?preview=true&view=summary`, {
        waitUntil: "networkidle",
      });
      assert.equal(new URL(page.url()).pathname, "/documents");
      assert.equal(new URL(page.url()).searchParams.get("preview"), id);
      assert.equal(new URL(page.url()).searchParams.get("view"), "summary");
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page
        .getByRole("form", { name: "Edit document", exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).pathname, fullPath);

      for (const width of [988, 829, 390]) {
        await page.setViewportSize({ width, height: 1034 });
        await page.goto(`${fullPath}?edit=true`, { waitUntil: "networkidle" });
        await page
          .getByRole("form", { name: "Edit document", exact: true })
          .waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.keyboard.press("Escape");
        await page.waitForURL((url) => !url.searchParams.has("edit"));
        assert.equal(new URL(page.url()).pathname, fullPath);
        const mountedPdf = await page.locator(".pdf-preview").elementHandle();
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await page
          .getByRole("form", { name: "Edit document", exact: true })
          .waitFor();
        assert.ok(await mountedPdf.evaluate((element) => element.isConnected));
        await page.getByRole("tab", { name: "Text", exact: true }).click();
        assert.equal(
          await page
            .getByRole("textbox", { name: "Extracted text", exact: true })
            .isVisible(),
          true,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.waitForURL((url) => !url.searchParams.has("edit"));
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  },
);

test(
  "selected cards and scan rows open full pages, with shared scan sidebar",
  { timeout: 60000 },
  async () => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 1034 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/documents?layout=grid", { waitUntil: "networkidle" });
      const card = page.locator("[data-collection-link]").first();
      const documentId = await card.getAttribute("data-item-id");
      await card.click();
      await page.getByRole("dialog", { name: /^Preview:/ }).waitFor();
      await card.click();
      await page.waitForURL(
        (url) => url.pathname === `/documents/${documentId}`,
      );
      const documentSidebar = await page
        .getByRole("complementary")
        .boundingBox();

      await page.goto("/scans", { waitUntil: "networkidle" });
      const scanRow = page.locator("[data-collection-link]").first();
      const scanId = await scanRow.getAttribute("data-item-id");
      await scanRow.click();
      await page.getByRole("dialog", { name: /^Preview:/ }).waitFor();
      await scanRow
        .locator("xpath=ancestor::tr")
        .click({ position: { x: 20, y: 20 } });
      await page.waitForURL(
        (url) =>
          url.pathname === `/scans/${scanId}` &&
          !url.searchParams.has("preview"),
      );
      const sidebar = page.getByRole("complementary");
      const scanSidebar = await sidebar.boundingBox();
      const header = await page
        .locator('[data-slot="collection-header"]')
        .boundingBox();
      assert.equal(scanSidebar.width, documentSidebar.width);
      assert.equal(scanSidebar.x, documentSidebar.x);
      assert.ok(scanSidebar.y >= header.y + header.height);
      assert.ok(
        await sidebar.getByText("Scanned at", { exact: true }).isVisible(),
      );
      assert.ok(await sidebar.getByText("Pages", { exact: true }).isVisible());
      const links = sidebar
        .getByRole("region", { name: "Extracted documents" })
        .getByRole("link");
      const count = await links.count();
      assert.ok(count > 0, "Use a scan with filed documents");
      await page
        .getByRole("navigation", { name: "Scan view" })
        .getByRole("link", { name: "Documents", exact: true })
        .click();
      await page.waitForURL(
        (url) => url.searchParams.get("view") === "documents",
      );
      await page
        .locator('.document-panel[data-active="true"] [data-collection-link]')
        .first()
        .waitFor();
      assert.equal(
        await page
          .locator('.document-panel[data-active="true"] [data-collection-link]')
          .count(),
        count,
      );
      const scanDocumentsURL = page.url();
      for (const layout of ["List view", "Grid view"]) {
        await page.getByRole("button", { name: layout, exact: true }).click();
        const documentLink = page
          .locator('.document-panel[data-active="true"] [data-collection-link]')
          .first();
        const id = await documentLink.getAttribute("data-item-id");
        const href = await documentLink.getAttribute("href");
        assert.equal(new URL(href, baseURL).pathname, `/documents/${id}`);
        assert.equal(new URL(href, baseURL).searchParams.has("preview"), false);
        await documentLink.click();
        await page.waitForURL((url) => url.pathname === `/documents/${id}`);
        assert.equal(new URL(page.url()).searchParams.has("preview"), false);
        await page.goto(scanDocumentsURL, { waitUntil: "networkidle" });
      }
      const destination = await links.first().getAttribute("href");
      await links.first().click();
      await page.waitForURL(
        (url) => url.pathname === new URL(destination, baseURL).pathname,
      );
      await page
        .getByRole("complementary")
        .locator('a[href^="/scans/"]')
        .click();
      await page.waitForURL((url) => url.pathname === `/scans/${scanId}`);
      assert.equal(new URL(page.url()).searchParams.has("preview"), false);
      assert.equal(
        await page.getByRole("dialog", { name: /^Preview:/ }).count(),
        0,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      const documentURL = new URL(destination, baseURL);
      documentURL.searchParams.set("view", "details");
      await page.goto(documentURL.href, { waitUntil: "networkidle" });
      const sourceLinks = page.locator(
        '.document-panel[data-active="true"] a[href^="/scans/"]',
      );
      for (const link of await sourceLinks.all()) {
        const href = await link.getAttribute("href");
        assert.equal(new URL(href, baseURL).searchParams.has("preview"), false);
      }
      await sourceLinks.first().click();
      await page.waitForURL((url) => url.pathname === `/scans/${scanId}`);
      assert.equal(new URL(page.url()).searchParams.has("preview"), false);
      await page
        .getByRole("navigation", { name: "Scan view" })
        .getByRole("link", { name: "Details", exact: true })
        .click();
      await page.waitForURL(
        (url) => url.searchParams.get("view") === "details",
      );
      await page
        .locator('.document-panel[data-active="true"]')
        .getByText("Scanned at", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  },
);
