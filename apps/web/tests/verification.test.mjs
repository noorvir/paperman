import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;
const dataDirectory = process.env.PAPERMAN_TEST_DATA_DIR;
if (
  !baseURL ||
  !browserURL ||
  !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
) {
  throw new Error(
    "Use a local app and an isolated PAPERMAN_TEST_DATA_DIR, with PAPERMAN_WEB_URL and PAPERMAN_BROWSER_URL.",
  );
}

test(
  "verification review compares source pages and saves only on confirmation",
  {
    timeout: 120000,
    skip:
      !dataDirectory &&
      "Set PAPERMAN_TEST_DATA_DIR to run this local write test",
  },
  async () => {
    const response = await fetch(new URL("/api/documents", baseURL));
    assert.equal(response.status, 200);
    const { items } = await response.json();
    const doc = items.find(
      (item) => !item.verification && item.source_pages[0] > 1,
    );
    const verified = items.find((item) => item.verification);
    assert.ok(
      doc && verified,
      "Use a verified document and an unverified document from later source pages",
    );
    const root = resolve(dataDirectory);
    const metadataPaths = [
      ...new Set([
        doc.final_path,
        ...doc.owner_ids.map(
          (owner) => `documents/${owner}/${basename(doc.final_path)}`,
        ),
      ]),
    ].map((path) => resolve(root, path.replace(/\.pdf$/, ".toml")));
    assert.ok(metadataPaths.every((path) => path.startsWith(root + sep)));
    const backups = await Promise.all(
      metadataPaths.map(async (path) => ({
        path,
        content: await readFile(path, "utf8"),
      })),
    );
    assert.ok(
      backups.every(
        ({ content }) =>
          content.includes(`id = "${doc.id}"`) &&
          !content.includes("[verification]"),
      ),
      "The local data must match the app's unverified document",
    );
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1532, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const fullPath = `/documents/${doc.id}`;
    const unchanged = async () => {
      const response = await context.request.get(`/api/documents/${doc.id}`);
      const detail = await response.json();
      assert.equal(detail.document.verification, null);
    };
    try {
      await page.goto(`/documents?preview=${doc.id}`, {
        waitUntil: "networkidle",
      });
      const preview = page.getByRole("dialog", { name: /^Preview:/ });
      await preview.getByText("Verify", { exact: true }).click();
      await page.waitForURL(
        (url) =>
          url.pathname === fullPath &&
          url.searchParams.get("verify") === "true",
      );
      await unchanged();
      const source = page.locator("#review-source");
      const document = page.locator("#review-document");
      await source.locator('.pdf-preview[aria-busy="false"]').waitFor();
      await document.locator('.pdf-preview[aria-busy="false"]').waitFor();
      assert.equal(
        await source
          .getByRole("textbox", { name: "PDF page number" })
          .inputValue(),
        String(doc.source_pages[0]),
      );
      const left = await document.boundingBox();
      const right = await source.boundingBox();
      assert.ok(
        Math.abs(left.width - right.width) < 1 && right.x > left.x + left.width,
      );
      const included = source.locator(
        `[data-page-number="${doc.source_pages[0]}"]`,
      );
      assert.equal(await included.getAttribute("data-included"), "true");
      assert.equal(
        await included.evaluate((el) => getComputedStyle(el).opacity),
        "1",
      );
      const pageInput = source.getByRole("textbox", {
        name: "PDF page number",
      });
      await pageInput.fill("1");
      await pageInput.press("Enter");
      const dimmed = source.locator('[data-page-number="1"]');
      await dimmed.waitFor();
      assert.equal(await dimmed.getAttribute("data-included"), "false");
      assert.equal(
        await dimmed.evaluate((el) => getComputedStyle(el).opacity),
        "0.25",
      );
      for (const tab of ["Text", "Summary", "Details", "PDF"]) {
        await document.getByRole("link", { name: tab, exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get("verify"), "true");
      }
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.waitForURL(
        (url) => url.pathname === fullPath && !url.searchParams.has("verify"),
      );
      await unchanged();
      await page.getByRole("link", { name: "Verify", exact: true }).click();
      await page
        .getByRole("heading", { name: "Review document", exact: true })
        .waitFor();
      await page
        .getByRole("heading", { name: "Review document", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await page.waitForURL(
        (url) => url.pathname === fullPath && !url.searchParams.has("verify"),
      );
      await unchanged();

      await page.getByRole("link", { name: "Verify", exact: true }).click();
      await source.locator('.pdf-preview[aria-busy="false"]').waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("tab", { name: "Source scan", exact: true }).click();
      await source.getByRole("button", { name: "Next PDF page" }).click();
      const sourcePage = await pageInput.inputValue();
      await page.getByRole("tab", { name: "Document", exact: true }).click();
      await document.getByRole("button", { name: "Next PDF page" }).click();
      const documentPage = await document
        .getByRole("textbox", { name: "PDF page number" })
        .inputValue();
      await page.getByRole("tab", { name: "Source scan", exact: true }).click();
      assert.equal(await pageInput.inputValue(), sourcePage);
      await page.getByRole("tab", { name: "Document", exact: true }).click();
      assert.equal(
        await document
          .getByRole("textbox", { name: "PDF page number" })
          .inputValue(),
        documentPage,
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Mark as verified" })
          .isEnabled(),
      );
      assert.equal(
        await page.getByRole("textbox", { name: "Your name" }).count(),
        0,
      );
      const failWrite = (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue();
      await context.route("**/*", failWrite);
      await page.getByRole("button", { name: "Mark as verified" }).click();
      await page.getByText("Action failed", { exact: true }).waitFor();

      await unchanged();
      await context.unroute("**/*", failWrite);
      await page.getByRole("button", { name: "Mark as verified" }).click();
      await page.waitForURL(
        (url) => url.pathname === fullPath && !url.searchParams.has("verify"),
      );
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("img", { name: "Verified", exact: true }).waitFor();
      assert.equal(
        await page
          .locator(".workspace-heading")
          .getByText("Verify", { exact: true })
          .count(),
        0,
      );
      const detailResponse = await context.request.get(
        `/api/documents/${doc.id}`,
      );
      const saved = (await detailResponse.json()).document;
      assert.equal(saved.verification.by, "unknown");
      assert.ok(Date.parse(saved.verification.at));
      assert.ok(
        (await readFile(metadataPaths[0], "utf8")).includes("[verification]"),
      );
      await page.setViewportSize({ width: 1532, height: 1000 });
      await page.goto("/documents", { waitUntil: "networkidle" });
      const row = page
        .getByRole("row")
        .filter({ has: page.getByText(doc.title, { exact: true }) });
      await row.getByText("Verified", { exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
      await browser.close();
      await Promise.all(
        backups.map(({ path, content }) => writeFile(path, content)),
      );
    }
  },
);
