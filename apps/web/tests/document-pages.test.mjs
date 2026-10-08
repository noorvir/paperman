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
  !dataDirectory ||
  !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
)
  throw new Error(
    "Use an isolated local app, browser, and PAPERMAN_TEST_DATA_DIR",
  );

test(
  "source page selection cancels, saves, and leaves sibling documents unchanged",
  { timeout: 90000 },
  async () => {
    const { items } = await (
      await fetch(new URL("/api/documents", baseURL))
    ).json();
    const doc = items.find(
      (item) =>
        item.source_pages.length === 2 &&
        item.source_pages[0] > 1 &&
        item.enrichment_status === "complete",
    );
    assert.ok(doc);
    const sibling = items.find(
      (item) =>
        item.scan_id === doc.scan_id &&
        item.id !== doc.id &&
        item.source_pages.some((number) => !doc.source_pages.includes(number)),
    );
    assert.ok(sibling);
    const addedPage = sibling.source_pages.find(
      (number) => !doc.source_pages.includes(number),
    );
    const removedPage = doc.source_pages[0];
    const expected = [
      addedPage,
      ...doc.source_pages.filter((number) => number !== removedPage),
    ];
    const root = resolve(dataDirectory);
    const backups = [];
    for (const file of new Set([
      doc.final_path,
      ...doc.owner_ids.map(
        (owner) => `documents/${owner}/${basename(doc.final_path)}`,
      ),
    ])) {
      for (const suffix of [".pdf", ".txt", ".toml"]) {
        const path = resolve(root, file.replace(/\.pdf$/, suffix));
        assert.ok(path.startsWith(root + sep));
        backups.push({ path, content: await readFile(path) });
      }
    }
    const indexPath = resolve(root, "state/search.json");
    backups.push({ path: indexPath, content: await readFile(indexPath) });
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1469, height: 1000 },
    });
    const page = await context.newPage();
    const path = `/documents/${doc.id}`;
    const getDocument = async (id) =>
      (await (await context.request.get(`/api/documents/${id}`)).json())
        .document;
    const goToPage = async (number) => {
      const input = page.getByRole("textbox", { name: "PDF page number" });
      await input.fill(String(number));
      await input.press("Enter");
      await page
        .getByRole("button", { name: `Include page ${number}`, exact: true })
        .waitFor();
    };
    const changePages = async () => {
      await page.locator('.pdf-preview[aria-busy="false"]').waitFor();
      await goToPage(addedPage);
      const add = page.getByRole("button", {
        name: `Include page ${addedPage}`,
        exact: true,
      });
      assert.equal(await add.getAttribute("aria-pressed"), "false");
      await add.click();
      const position = page.getByRole("textbox", {
        name: `Position for scan page ${addedPage}`,
        exact: true,
      });
      assert.equal(
        await position.inputValue(),
        String(doc.source_pages.length + 1),
      );
      await position.fill("1");
      await position.press("Enter");
      assert.equal(await position.inputValue(), "1");
      await goToPage(removedPage);
      await page
        .getByRole("button", {
          name: `Include page ${removedPage}`,
          exact: true,
        })
        .click();
    };
    try {
      await page.goto(`${path}?edit=true`, { waitUntil: "networkidle" });
      const save = page.getByRole("button", {
        name: "Save changes",
        exact: true,
      });
      assert.equal(await save.isDisabled(), true);
      assert.equal(
        await page
          .getByRole("button", { name: "Edit pages", exact: true })
          .count(),
        0,
      );
      await changePages();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", { name: "Discard changes", exact: true })
        .click();
      await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
      assert.deepEqual(await getDocument(doc.id), doc);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await changePages();
      await goToPage(addedPage);
      await page
        .getByRole("button", { name: "Rotate current page clockwise" })
        .click();
      const rejectWrite = (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue();
      await context.route("**/*", rejectWrite);
      await save.click();
      await page.getByText("Action failed", { exact: true }).waitFor();
      assert.deepEqual(await getDocument(doc.id), doc);
      await context.unroute("**/*", rejectWrite);
      await save.click();
      await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
      const updated = await getDocument(doc.id);
      assert.deepEqual(updated.source_pages, expected);
      assert.deepEqual(updated.verification, doc.verification);
      assert.ok(
        updated.manual_rotations.some(
          (rotation) =>
            rotation.page === expected.indexOf(addedPage) + 1 &&
            rotation.clockwise === 90,
        ),
      );
      assert.deepEqual(await getDocument(sibling.id), sibling);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.locator('.pdf-preview[aria-busy="false"]').waitFor();
      assert.equal(await save.isDisabled(), true);
      await goToPage(addedPage);
      assert.equal(
        await page
          .getByRole("button", {
            name: `Include page ${addedPage}`,
            exact: true,
          })
          .getAttribute("aria-pressed"),
        "true",
      );
    } finally {
      await context.close();
      await browser.close();
      await Promise.all(
        backups.map(({ path, content }) => writeFile(path, content)),
      );
    }
  },
);
