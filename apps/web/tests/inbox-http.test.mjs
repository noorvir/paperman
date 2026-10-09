import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.PAPERMAN_INBOX_TEST_URL;
const email = process.env.PAPERMAN_INBOX_TEST_EMAIL;
const password = process.env.PAPERMAN_INBOX_TEST_PASSWORD;
const otherEmail = process.env.PAPERMAN_INBOX_TEST_OTHER_EMAIL;
const fixture = process.env.PAPERMAN_INBOX_TEST_PDF;

test(
  "real web sessions scope personal uploads, source reads, settings and server-rendered navigation",
  {
    skip: !base || !email || !password || !otherEmail || !fixture,
    timeout: 60000,
  },
  async () => {
    assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
    async function login(address) {
      const response = await fetch(`${base}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ email: address, password }),
      });
      const responseText = await response.text();
      assert.equal(response.status, 200, responseText);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    }
    const cookie = await login(email);
    const otherCookie = await login(otherEmail);
    async function request(path, options = {}, session = cookie) {
      return fetch(base + path, {
        ...options,
        headers: { Cookie: session, Origin: base, ...options.headers },
        redirect: "manual",
      });
    }
    async function json(path, session = cookie) {
      const response = await request(path, {}, session);
      const text = await response.text();
      assert.equal(response.status, 200, text);
      return JSON.parse(text);
    }
    for (const path of ["/", "/settings", "/scans", "/scans/upload"]) {
      const response = await request(path);
      const html = await response.text();
      assert.equal(response.status, 200, html.slice(0, 1000));
      assert.match(html, /href="\/scans/);
      assert.match(html, /href="\/settings/);
      if (path === "/settings") {
        assert.match(html, /Your account/);
        assert.match(html, /Your inbox/);
        assert.doesNotMatch(html, /Rebuild search index/);
      }
    }
    const inboxes = await json("/api/inboxes");
    assert.equal(inboxes.length, 1);
    const personal = inboxes[0];
    assert.ok(personal.id.startsWith("personal-"));
    const body = new FormData();
    const bytes = await readFile(fixture);
    body.set(
      "file",
      new Blob([bytes], { type: "application/pdf" }),
      "personal-mail.pdf",
    );
    const upload = await request("/api/uploads", { method: "POST", body });
    assert.equal(upload.status, 200);
    const scan = await upload.json();
    assert.equal(scan.inbox_id, personal.id);
    const original = await request(`/api/scans/${scan.id}/pdf`);
    assert.equal(original.status, 200);
    const originalBytes = await original.arrayBuffer();
    assert.deepEqual(Buffer.from(originalBytes), bytes);
    const hiddenScan = await request(`/api/scans/${scan.id}`, {}, otherCookie);
    const hiddenPdf = await request(
      `/api/scans/${scan.id}/pdf`,
      {},
      otherCookie,
    );
    assert.equal(hiddenScan.status, 404);
    assert.equal(hiddenPdf.status, 404);
    const ownList = await json("/api/scans");
    const otherList = await json("/api/scans", otherCookie);
    assert.ok(ownList.items.some((item) => item.id === scan.id));
    assert.ok(!otherList.items.some((item) => item.id === scan.id));
    const detail = await request(`/scans/${scan.id}`);
    assert.equal(detail.status, 200);
    const detailHtml = await detail.text();
    assert.match(detailHtml, /personal-mail.pdf/);
    const globalSettings = await request("/api/settings");
    assert.equal(globalSettings.status, 403);
    const saved = await request("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time_format: "12h" }),
    });
    assert.equal(saved.status, 200);
    const savedPreferences = await saved.json();
    const otherPreferences = await json("/api/workspace", otherCookie);
    assert.equal(savedPreferences.time_format, "12h");
    assert.equal(otherPreferences.time_format, "24h");
    const rejected = await request("/api/workspace", {
      method: "PUT",
      headers: {
        Origin: "https://other.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ time_format: "24h" }),
    });
    assert.equal(rejected.status, 403);
    let processed = await json(`/api/scans/${scan.id}`);
    for (
      let attempt = 0;
      !["review", "complete", "failed"].includes(processed.status) &&
      attempt < 80;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      processed = await json(`/api/scans/${scan.id}`);
    }
    assert.notEqual(
      processed.status,
      "failed",
      JSON.stringify(processed.history),
    );
    if (processed.status === "review") {
      const approval = await request(`/api/scans/${scan.id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...processed.proposal, document_revisions: {} }),
      });
      const approvalText = await approval.text();
      assert.equal(approval.status, 200, approvalText);
    }
    for (
      let attempt = 0;
      processed.status !== "complete" && attempt < 80;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      processed = await json(`/api/scans/${scan.id}`);
    }
    assert.equal(processed.status, "complete");
    assert.ok(processed.document_ids.length > 0);
    const id = processed.document_ids[0];
    const document = await json(`/api/documents/${id}`);
    assert.equal(document.source.accessible, true);
    assert.equal(document.document.delivery_status, "delivered");
    const forbidden = await request(`/api/documents/${id}`, {}, otherCookie);
    assert.equal(forbidden.status, 404);
    const recipients = await json(`/api/documents/${id}/access`);
    const otherInboxes = await json("/api/inboxes", otherCookie);
    const otherId = otherInboxes[0].account_id;
    assert.ok(
      recipients.recipients.some((item) => item.account_id === otherId),
    );
    const granted = await request(`/api/documents/${id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revision: recipients.revision,
        user_ids: [otherId],
      }),
    });
    const grantText = await granted.text();
    assert.equal(granted.status, 200, grantText);
    const shared = await json(`/api/documents/${id}`, otherCookie);
    assert.equal(shared.source.accessible, false);
    assert.equal(shared.can_manage_access, false);
    const documentPage = await request(
      `/documents/${id}?view=source`,
      {},
      otherCookie,
    );
    assert.equal(documentPage.status, 200);
    const documentHtml = await documentPage.text();
    assert.match(documentHtml, /Source access restricted/);
    const privateSource = await request(
      `/api/scans/${scan.id}/pdf`,
      {},
      otherCookie,
    );
    assert.equal(privateSource.status, 404);
    const latest = await json(`/api/documents/${id}/access`);
    const revoked = await request(`/api/documents/${id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: latest.revision, user_ids: [] }),
    });
    assert.equal(revoked.status, 200);
    const revokedDocument = await request(
      `/api/documents/${id}/pdf`,
      {},
      otherCookie,
    );
    assert.equal(revokedDocument.status, 404);
    const signedOut = await request("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(signedOut.status, 200);
    const loggedOut = await request("/api/scans");
    assert.equal(loggedOut.status, 401);
  },
);
