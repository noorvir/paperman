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
) {
  throw new Error(
    "Use a local app, browser, and isolated PAPERMAN_TEST_DATA_DIR.",
  );
}

test(
  "adding and removing tags preserves other metadata and handles failure",
  { timeout: 60000 },
  async () => {
    const { items } = await (
      await fetch(new URL("/api/documents", baseURL))
    ).json();
    const catalog = await (
      await fetch(new URL("/api/catalog", baseURL))
    ).json();
    const doc = items.find(
      (item) => item.verification && item.enrichment_status === "complete",
    );
    assert.ok(doc, "Use a verified document in the isolated test data");
    const selected = [
      ...new Set([
        ...doc.generated_tags.filter((id) => !doc.excluded_tags.includes(id)),
        ...doc.user_tags,
      ]),
    ];
    const tag = catalog.tags.find((item) => !selected.includes(item.id));
    assert.ok(tag);
    const root = resolve(dataDirectory);
    const backups = [];
    for (const file of new Set([
      doc.final_path,
      ...doc.owner_ids.map(
        (owner) => `documents/${owner}/${basename(doc.final_path)}`,
      ),
    ])) {
      const path = resolve(root, file.replace(/\.pdf$/, ".toml"));
      assert.ok(path.startsWith(root + sep));
      const content = await readFile(path, "utf8");
      assert.ok(content.includes(`id = "${doc.id}"`));
      backups.push({ path, content });
    }
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1469, height: 1000 },
    });
    const page = await context.newPage();
    const getDocument = async () =>
      (await (await context.request.get(`/api/documents/${doc.id}`)).json())
        .document;
    try {
      await page.goto(`/documents/${doc.id}`, { waitUntil: "networkidle" });
      const sidebar = page.locator(".detail-sidebar");
      const add = sidebar.getByRole("button", { name: "Add tag", exact: true });
      await add.click();
      for (const id of selected) {
        const entry = catalog.tags.find((item) => item.id === id);
        if (entry)
          assert.equal(
            await page
              .getByRole("menuitem", { name: entry.name, exact: true })
              .count(),
            0,
          );
      }
      const rejectWrite = (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue();
      await context.route("**/*", rejectWrite);
      await page.getByRole("menuitem", { name: tag.name, exact: true }).click();
      await sidebar.getByRole("alert").waitFor();
      assert.deepEqual(await getDocument(), doc);
      await context.unroute("**/*", rejectWrite);
      await add.click();
      await page.getByRole("menuitem", { name: tag.name, exact: true }).click();
      await sidebar
        .getByRole("link", { name: `Filter by ${tag.name}`, exact: true })
        .waitFor();
      const saved = await getDocument();
      assert.deepEqual(saved.user_tags, [...selected, tag.id].sort());
      for (const field of [
        "verification",
        "owner_ids",
        "title",
        "summary",
        "document_date",
        "manual_rotations",
        "text_override",
      ]) {
        assert.deepEqual(saved[field], doc[field], field);
      }
      await page.reload({ waitUntil: "networkidle" });
      await sidebar
        .getByRole("link", { name: `Filter by ${tag.name}`, exact: true })
        .waitFor();
      await add.click();
      assert.equal(
        await page
          .getByRole("menuitem", { name: tag.name, exact: true })
          .count(),
        0,
      );
      await page.keyboard.press("Escape");
      const removedTag = catalog.tags.find((entry) =>
        selected.includes(entry.id),
      );
      assert.ok(removedTag, "Use a document with an existing tag");
      const remove = sidebar.getByRole("button", {
        name: `Remove ${removedTag.name}`,
        exact: true,
      });
      await context.route("**/*", rejectWrite);
      await remove.click();
      await sidebar.getByRole("alert").waitFor();
      assert.deepEqual(await getDocument(), saved);
      await context.unroute("**/*", rejectWrite);
      await remove.click();
      await remove.waitFor({ state: "detached" });
      const afterRemoval = await getDocument();
      assert.deepEqual(
        afterRemoval.user_tags,
        [...selected.filter((id) => id !== removedTag.id), tag.id].sort(),
      );
      assert.ok(afterRemoval.excluded_tags.includes(removedTag.id));
      assert.deepEqual(afterRemoval.verification, doc.verification);
      assert.equal(new URL(page.url()).pathname, `/documents/${doc.id}`);
      await page.reload({ waitUntil: "networkidle" });
      await add.click();
      await page
        .getByRole("menuitem", { name: removedTag.name, exact: true })
        .waitFor();
      assert.equal(await remove.count(), 0);
    } finally {
      await context.close();
      await browser.close();
      await Promise.all(
        backups.map(({ path, content }) => writeFile(path, content)),
      );
    }
  },
);
