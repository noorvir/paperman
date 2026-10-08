import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  "table headings sort all documents and saved time format controls timestamps",
  { timeout: 90000 },
  async () => {
    const settingsPath = resolve(dataDirectory, "settings.toml");
    const backup = await readFile(settingsPath);
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1469, height: 1000 },
      locale: "en-US",
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    try {
      await page.goto("/documents", { waitUntil: "networkidle" });
      assert.equal(
        await page.getByRole("button", { name: "Sort documents" }).count(),
        0,
      );
      assert.doesNotMatch(
        await page.locator("tbody tr").first().locator("td").last().innerText(),
        /AM|PM/,
      );
      for (const [label, ascending, descending] of [
        ["Date", "date_asc", "date_desc"],
        ["Document", "title", "title_desc"],
        ["Owners", "owners_asc", "owners_desc"],
        ["Tags", "tags_asc", "tags_desc"],
        ["Verification", "verification_asc", "verification_desc"],
        ["Processed at", "processed_asc", "processed_desc"],
      ]) {
        const header = page.getByRole("columnheader").filter({
          has: page.getByRole("button", { name: label, exact: true }),
        });
        for (const [sort, direction] of [
          [ascending, "ascending"],
          [descending, "descending"],
        ]) {
          await header.getByRole("button").click();
          await page.waitForFunction(
            ({ label, direction }) =>
              Array.from(document.querySelectorAll("th")).some(
                (th) =>
                  th.textContent.trim() === label &&
                  th.getAttribute("aria-sort") === direction,
              ),
            { label, direction },
          );
          const response = await context.request.get(
            `/api/documents?sort=${sort}`,
          );
          assert.equal(response.status(), 200);
          const { items } = await response.json();
          const titles = await page
            .locator("tbody tr")
            .getByRole("link", { name: /^Preview / })
            .evaluateAll((links) =>
              links.map((link) => link.getAttribute("aria-label").slice(8)),
            );
          assert.deepEqual(
            titles,
            items.map((doc) => doc.title),
          );
        }
      }
      await page.goto("/settings", { waitUntil: "networkidle" });
      await page.getByRole("combobox", { name: "Time format" }).click();
      await page
        .getByRole("option", { name: "12-hour (9:30 PM)", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save settings", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Settings saved" })
        .waitFor();
      await page.goto("/documents", { waitUntil: "networkidle" });
      assert.match(
        await page.locator("tbody tr").first().locator("td").last().innerText(),
        /AM|PM/,
      );
      await page.goto("/settings", { waitUntil: "networkidle" });
      await page.getByRole("combobox", { name: "Time format" }).click();
      await page
        .getByRole("option", { name: "24-hour (21:30)", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save settings", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Settings saved" })
        .waitFor();
      await page.goto("/documents", { waitUntil: "networkidle" });
      assert.doesNotMatch(
        await page.locator("tbody tr").first().locator("td").last().innerText(),
        /AM|PM/,
      );
    } finally {
      await context.close();
      await browser.close();
      await writeFile(settingsPath, backup);
    }
  },
);
