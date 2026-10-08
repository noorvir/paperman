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
  "document source review and direct verification preserve the current view",
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
    const docs = items.filter((item) => !item.verification);
    const doc = docs.find((item) => item.source_pages[0] > 1);
    const previewDoc = docs.find((item) => item.id !== doc?.id);
    assert.ok(
      doc && previewDoc,
      "Use two unverified local documents, including one from later source pages",
    );
    const root = resolve(dataDirectory);
    const backups = [];
    for (const document of [doc, previewDoc]) {
      const paths = new Set([
        document.final_path,
        ...document.owner_ids.map(
          (owner) => `documents/${owner}/${basename(document.final_path)}`,
        ),
      ]);
      for (const file of paths) {
        const path = resolve(root, file.replace(/\.pdf$/, ".toml"));
        assert.ok(path.startsWith(root + sep));
        const content = await readFile(path, "utf8");
        assert.ok(
          content.includes(`id = "${document.id}"`) &&
            !content.includes("[verification]"),
        );
        backups.push({ path, content });
      }
    }
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1532, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const fullPath = `/documents/${doc.id}`;
    const source = page.locator('.document-panel[aria-label="Source scan"]');
    const tabs = page.getByRole("navigation", { name: "Document view" });
    const getDocument = async (id) => {
      const response = await context.request.get(`/api/documents/${id}`);
      const detail = await response.json();
      return detail.document;
    };
    try {
      await page.goto(`${fullPath}?verify=true`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, fullPath);
      assert.equal(new URL(page.url()).searchParams.has("verify"), false);
      await page
        .getByRole("button", { name: "View in context", exact: true })
        .click();
      await tabs.getByRole("link", { name: "PDF", exact: true }).click();
      const initial = await getDocument(doc.id);
      assert.equal(initial.verification, null);
      await page
        .getByRole("img", { name: "Not verified", exact: true })
        .waitFor();
      assert.equal(await tabs.getByRole("link").count(), 5);
      await page
        .locator(".detail-sidebar")
        .getByRole("link", { name: /\.pdf$/ })
        .click();
      await source.locator('.pdf-preview[aria-busy="false"]').waitFor();
      const pageInput = source.getByRole("textbox", {
        name: "PDF page number",
      });
      await page.waitForFunction(
        (first) =>
          document.querySelector(
            '.document-panel[aria-label="Source scan"] input[aria-label="PDF page number"]',
          )?.value === String(first),
        doc.source_pages[0],
      );
      assert.equal(new URL(page.url()).pathname, fullPath);
      assert.equal(new URL(page.url()).searchParams.get("view"), "source");
      const included = source.locator(
        `[data-page-number="${doc.source_pages[0]}"]`,
      );
      assert.equal(await included.getAttribute("data-included"), "true");
      await pageInput.fill("1");
      await pageInput.press("Enter");
      const dimmed = source.locator('[data-page-number="1"]');
      await dimmed.waitFor();
      assert.equal(
        await dimmed.evaluate((el) => getComputedStyle(el).opacity),
        "0.25",
      );
      for (const name of ["Text", "Summary", "Details", "PDF", "Source"]) {
        await tabs.getByRole("link", { name, exact: true }).click();
      }
      assert.equal(await pageInput.inputValue(), "1");
      await page.setViewportSize({ width: 390, height: 844 });
      await source.getByText("Source scan details", { exact: true }).click();
      await source
        .getByRole("link", { name: doc.title, exact: true })
        .waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false);
      await source.getByText("Source scan details", { exact: true }).click();
      await page.setViewportSize({ width: 1532, height: 1000 });
      await tabs.getByRole("link", { name: "PDF", exact: true }).click();
      await page
        .getByRole("button", { name: "View in context", exact: true })
        .click();
      const documentPdf = page
        .locator(".pdf-viewer")
        .and(page.getByRole("region", { name: doc.title, exact: true }));
      await documentPdf.waitFor();
      await documentPdf
        .getByRole("button", { name: "Zoom in", exact: true })
        .click();
      const documentPage = documentPdf.getByRole("textbox", {
        name: "PDF page number",
      });
      await documentPage.fill("2");
      await documentPage.press("Enter");
      await page.waitForTimeout(300);
      const pdfNode = await documentPdf.elementHandle();
      const renderedPage = await documentPdf
        .locator('[data-page-number="2"] img')
        .first()
        .elementHandle();
      const zoom = await documentPdf
        .getByRole("combobox", { name: "PDF zoom" })
        .innerText();
      const pdfRequests = [];
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname === `/api/documents/${doc.id}/pdf`
        ) {
          pdfRequests.push(request.url());
        }
      });
      const writeGate = Promise.withResolvers();
      const failWrite = async (route) => {
        if (route.request().method() !== "POST") {
          return route.continue();
        }
        await writeGate.promise;
        return route.abort();
      };
      await context.route("**/*", failWrite);
      const verify = page.getByRole("button", {
        name: "Mark as verified",
        exact: true,
      });
      const width = await verify.evaluate(
        (button) => button.getBoundingClientRect().width,
      );
      await verify.click();
      try {
        await page.locator('button[aria-busy="true"]').waitFor();
        const loading = await verify.evaluate((button) => ({
          text: button.innerText.trim(),
          width: button.getBoundingClientRect().width,
          animation: getComputedStyle(
            button.querySelector('[data-slot="spinner"]'),
          ).animationName,
        }));
        assert.equal(loading.text, "Mark as verified");
        assert.equal(loading.width, width);
        assert.equal(loading.animation, "spin");
      } finally {
        writeGate.resolve();
      }
      await page.getByText("Action failed", { exact: true }).waitFor();
      const failed = await getDocument(doc.id);
      assert.equal(failed.verification, null);
      await context.unroute("**/*", failWrite);
      const viewURL = page.url();
      const headerBounds = () =>
        page.locator('[data-slot="collection-header"]').evaluate((header) =>
          Array.from(header.querySelectorAll("h1, button, nav")).map(
            (element) => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return { x, y, width, height };
            },
          ),
        );
      const beforeSuccess = await headerBounds();
      await page
        .getByRole("button", { name: "Mark as verified", exact: true })
        .click();
      await page.getByRole("img", { name: "Verified", exact: true }).waitFor();
      assert.equal(page.url(), viewURL);
      const afterSuccess = await headerBounds();
      assert.deepEqual(afterSuccess, beforeSuccess);
      await page.waitForTimeout(5500);
      assert.equal(await pdfNode.evaluate((el) => el.isConnected), true);
      assert.equal(await renderedPage.evaluate((el) => el.isConnected), true);
      assert.equal(
        await documentPdf
          .getByRole("combobox", { name: "PDF zoom" })
          .innerText(),
        zoom,
      );
      assert.equal(await documentPage.inputValue(), "2");
      assert.deepEqual(
        pdfRequests,
        [],
        "Verification and polling must not reload the PDF",
      );
      const saved = await getDocument(doc.id);
      assert.equal(saved.verification.by, "unknown");
      assert.ok(Date.parse(saved.verification.at));
      await page.reload({ waitUntil: "networkidle" });
      await documentPdf.waitFor();
      await page.getByRole("img", { name: "Verified", exact: true }).waitFor();
      await page.setViewportSize({ width: 1532, height: 1000 });
      await page.goto(`/documents?preview=${previewDoc.id}&view=details`, {
        waitUntil: "networkidle",
      });
      const preview = page.getByRole("dialog", { name: /^Preview:/ });
      await preview
        .getByRole("link", { name: /\.pdf$/ })
        .first()
        .click();
      await source.locator('.pdf-preview[aria-busy="false"]').waitFor();
      await preview
        .getByRole("navigation", { name: "Document view" })
        .getByRole("link", { name: "PDF", exact: true })
        .click();
      assert.equal(
        await preview
          .getByRole("button", { name: "View in context", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await preview
          .getByRole("button", { name: "Mark as verified", exact: true })
          .count(),
        0,
      );
      await preview
        .getByRole("link", { name: "Not verified", exact: true })
        .waitFor();
      await preview
        .getByRole("heading", { name: previewDoc.title, exact: true })
        .getByRole("link")
        .click();
      await page.waitForURL(
        (url) => url.pathname === `/documents/${previewDoc.id}`,
      );
      await page
        .getByRole("button", { name: "Mark as verified", exact: true })
        .waitFor();
      assert.equal((await getDocument(previewDoc.id)).verification, null);
      await page.goto("/documents", { waitUntil: "networkidle" });
      const row = page
        .getByRole("row")
        .filter({ has: page.getByText(doc.title, { exact: true }) });
      await row.getByRole("img", { name: "Verified", exact: true }).waitFor();
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
