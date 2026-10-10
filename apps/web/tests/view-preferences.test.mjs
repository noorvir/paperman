import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

const baseURL = process.env.PAPERMAN_WEB_URL;
const browserURL = process.env.PAPERMAN_BROWSER_URL;

test(
  "view controls survive reloads and return visits through URL state",
  {
    skip: !baseURL || !browserURL,
    timeout: 120000,
  },
  async () => {
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
    const browser = await chromium.connectOverCDP(browserURL);
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1600, height: 1000 },
      storageState: {
        cookies: await browser.contexts()[0].cookies(),
        origins: [],
      },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const query = () => new URL(page.url()).searchParams;
    const defaults = {
      q: "",
      owner: "[]",
      creator: "[]",
      tag: "[]",
      status: "",
      after: "",
      before: "",
      delivery: "",
      inbox: "",
      layout: "list",
      sort: "date_desc",
      view: "pdf",
      zoom: "automatic",
      editorTab: "details",
      panel: "documents",
      category: "All",
    };
    async function param(key, value) {
      await page.waitForURL(
        (url) =>
          url.searchParams.get(key) ===
          (defaults[key] === value ? null : value),
      );
      const path = new URL(page.url()).pathname;
      let group = path.split("/")[1] || "overview";
      if (group === "scans" && ["layout", "view"].includes(key))
        group = "scan-view";
      if (key === "zoom") group = "pdf";
      if (key === "editorTab") group = "document-editor";
      await page.waitForFunction(
        ([key, value, group]) =>
          Object.keys(localStorage)
            .filter(
              (name) =>
                name.startsWith("paperman.preferences.v1:") &&
                name.endsWith(`:${group}`),
            )
            .some((name) => {
              const current = JSON.parse(localStorage.getItem(name))[key];
              return (
                (typeof current === "object"
                  ? JSON.stringify(current)
                  : String(current)) === value
              );
            }),
        [key, value, group],
      );
    }
    async function go(path) {
      await page.goto(path, { waitUntil: "networkidle" });
      assert.ok(
        !page.url().includes("/login"),
        "Use the local signed-in browser session",
      );
    }
    try {
      await go(
        "/documents?layout=list&delivery=&inbox=&q=&owner=%5B%5D&creator=%5B%5D&tag=%5B%5D&status=&after=&before=&sort=date_desc&columns=%7B%22date%22%3Atrue%2C%22owners%22%3Atrue%2C%22creators%22%3Atrue%2C%22tags%22%3Atrue%2C%22verification%22%3Atrue%2C%22processed%22%3Atrue%7D&context=false&view=pdf&zoom=automatic&editorTab=details",
      );
      assert.equal(new URL(page.url()).search, "");
      const all = await (await context.request.get("/api/documents")).json();
      const document = all.items[0];
      assert.ok(document, "The local instance needs a document fixture");

      // One-time migration keeps the user's earlier column selection.
      await go("/");
      await page.evaluate(() => {
        for (const key of Object.keys(localStorage))
          localStorage.removeItem(key);
        localStorage.setItem(
          "paperman.document-columns",
          JSON.stringify({ owners: false }),
        );
      });
      await go("/documents");
      assert.equal(JSON.parse(query().get("columns")).owners, false);
      assert.equal(
        await page.getByRole("columnheader", { name: "Owners" }).count(),
        0,
      );
      await page.getByRole("button", { name: "Columns", exact: true }).click();
      await page
        .getByRole("menuitemcheckbox", { name: "Owners", exact: true })
        .click();
      await page
        .getByRole("menuitemcheckbox", { name: "Created by", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await page
        .getByRole("columnheader", { name: "Document", exact: true })
        .getByRole("button")
        .click();
      await param("sort", "title");
      await page
        .getByPlaceholder("Search documents")
        .fill(document.title.split(" ")[0]);
      await page.getByPlaceholder("Search documents").press("Enter");
      await param("q", document.title.split(" ")[0]);
      await page
        .getByRole("button", { name: "Grid view", exact: true })
        .click();
      await param("layout", "grid");
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page
          .getByRole("button", { name: "Grid view" })
          .getAttribute("aria-pressed"),
        "true",
      );
      await go("/roadmap");
      await page.getByRole("button", { name: "Internal", exact: true }).click();
      await param("category", "Internal");
      await go("/documents");
      assert.equal(query().get("sort"), "title");
      assert.equal(query().get("layout"), "grid");
      assert.equal(query().get("q"), document.title.split(" ")[0]);
      assert.equal(JSON.parse(query().get("columns")).creators, false);

      // Explicit empty/default values override earlier stored settings.
      await go(
        "/documents?q=&owner=[]&tag=[]&layout=list&sort=date_desc#library",
      );
      assert.equal(query().get("q"), null);
      assert.equal(query().get("layout"), null);
      assert.equal(new URL(page.url()).hash, "#library");
      await page.getByRole("button", { name: "Grid view" }).click();
      await param("layout", "grid");
      await page.goBack({ waitUntil: "networkidle" });
      assert.equal(query().get("layout"), null);
      await page.goForward({ waitUntil: "networkidle" });
      assert.equal(query().get("layout"), "grid");

      // Clean history entries must not restore a newer saved filter.
      await page.getByRole("button", { name: "List view" }).click();
      await param("layout", "list");
      await go("/roadmap");
      await go("/documents?q=history&layout=grid");
      await page.goBack({ waitUntil: "networkidle" });
      await page.goBack({ waitUntil: "networkidle" });
      assert.equal(query().get("q"), null);
      assert.equal(query().get("layout"), null);
      await page.goForward({ waitUntil: "networkidle" });
      await page.goForward({ waitUntil: "networkidle" });
      assert.equal(query().get("q"), "history");
      assert.equal(query().get("layout"), "grid");

      // All document filters pass through the same schema and restore as a unit.
      const filters = {
        owner: document.owner_ids,
        creator: document.creator_ids,
        tag: document.user_tags,
        after: "2020-01-01",
        before: "2030-01-01",
        delivery: "delivered",
        status: "complete",
        inbox: "shared",
      };
      const filtered = new URL("/documents", baseURL);
      for (const [key, value] of Object.entries(filters))
        filtered.searchParams.set(
          key,
          Array.isArray(value) ? JSON.stringify(value) : value,
        );
      await go(filtered.href);
      await go("/documents");
      for (const [key, value] of Object.entries(filters))
        assert.equal(
          query().get(key),
          Array.isArray(value)
            ? value.length
              ? JSON.stringify(value)
              : null
            : value,
        );
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .filter({ visible: true })
        .click();
      await param("owner", "[]");
      await go("/documents");
      assert.equal(query().get("after"), null);
      assert.equal(query().get("delivery"), null);

      await go(`/documents/${document.id}?view=summary`);
      await go(`/documents/${document.id}`);
      assert.equal(query().get("view"), "summary");
      await page
        .getByRole("navigation", { name: "Document view" })
        .getByRole("link", { name: "PDF", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "PDF zoom" })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("option", { name: "Fit width", exact: true })
        .click();
      await param("zoom", "fit-width");
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(query().get("zoom"), "fit-width");
      assert.equal(
        await page
          .getByRole("combobox", { name: "PDF zoom" })
          .filter({ visible: true })
          .innerText(),
        "Fit width",
      );
      await page
        .getByRole("button", { name: "View in context", exact: true })
        .click();
      await param("context", "true");
      assert.ok(new URL(page.url()).pathname.endsWith(document.id));
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page
        .getByLabel("Title", { exact: true })
        .fill(`${document.title} draft`);
      await page.getByRole("tab", { name: "Text", exact: true }).click();
      await param("editorTab", "text");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page.getByRole("tab", { name: "Details", exact: true }).click();
      assert.equal(
        await page.getByLabel("Title", { exact: true }).inputValue(),
        `${document.title} draft`,
      );
      await page.getByRole("tab", { name: "Text", exact: true }).click();
      await param("editorTab", "text");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Discard unsaved changes?" })
        .waitFor();
      await page
        .getByRole("button", { name: "Discard changes", exact: true })
        .click();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      assert.equal(
        await page
          .getByRole("tab", { name: "Text", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("tab", { name: "Details", exact: true }).click();
      assert.equal(
        await page.getByLabel("Title", { exact: true }).inputValue(),
        document.title,
      );

      await go(`/scans/${document.scan_id}?view=documents`);
      assert.equal(query().get("zoom"), "fit-width");
      await page.getByRole("button", { name: "Grid view" }).click();
      await param("layout", "grid");
      await go(`/scans/${document.scan_id}`);
      assert.equal(query().get("view"), "documents");
      assert.equal(query().get("layout"), "grid");
      await page.getByRole("button", { name: "List view" }).click();
      await param("layout", "list");
      await page
        .getByRole("link", { name: `Open ${document.title}`, exact: true })
        .click();
      await page.waitForURL(
        (url) => url.pathname === `/documents/${document.id}`,
      );
      await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
      assert.equal(query().get("layout"), "grid");
      assert.equal(JSON.parse(query().get("columns")).creators, false);
      await go("/scans?status=complete&q=Mail&inbox=shared");
      await go("/roadmap");
      assert.equal(query().get("category"), "Internal");
      await go("/scans");
      assert.equal(query().get("status"), "complete");
      assert.equal(
        await page.getByPlaceholder("Search scans").inputValue(),
        "Mail",
      );
      await page.getByRole("combobox", { name: "Scan status" }).click();
      await page
        .getByRole("option", { name: "All scans", exact: true })
        .click();
      await param("status", "");
      await page.getByRole("button", { name: "Clear search" }).click();
      await param("q", "");
      await go("/scans");
      assert.equal(query().get("q"), null);

      await page.setViewportSize({ width: 390, height: 844 });
      await go("/");
      await page
        .getByRole("tab", { name: "Needs attention", exact: true })
        .click();
      await param("panel", "attention");
      await go("/roadmap");
      await go("/");
      assert.equal(
        await page
          .getByRole("tab", { name: "Needs attention", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await go("/?status=unverified&panel=documents");
      await go("/");
      assert.equal(query().get("status"), "unverified");
      await page
        .getByRole("button", { name: "Recent documents", exact: true })
        .click();
      await param("status", "");
      await go("/");
      assert.equal(query().get("status"), null);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  },
);
