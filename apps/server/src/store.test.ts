import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";

import { DuplicateTagError, openStore } from "./store";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

test("reads PDF scan batches without changing originals", async () => {
  const directory = await mkdtemp(join(tmpdir(), "paperman-"));
  directories.push(directory);
  const store = await Effect.runPromise(openStore(directory));
  const original = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  await writeFile(join(store.inboxDirectory, "Mail_20260930.pdf"), original);
  await writeFile(join(store.inboxDirectory, "notes.txt"), "not a scan");

  const scans = await Effect.runPromise(store.listInbox());

  expect(scans).toHaveLength(1);
  expect(scans[0]?.name).toBe("Mail_20260930.pdf");
  expect(scans[0]?.sizeBytes).toBe(original.length);
  expect(
    await readFile(join(store.inboxDirectory, "Mail_20260930.pdf")),
  ).toEqual(Buffer.from(original));
});

test("persists tags and rejects duplicate names without losing the first tag", async () => {
  const directory = await mkdtemp(join(tmpdir(), "paperman-"));
  directories.push(directory);
  const store = await Effect.runPromise(openStore(directory));
  const tag = await Effect.runPromise(store.createTag("Insurance"));
  const duplicate = await Effect.runPromise(
    Effect.either(store.createTag("insurance")),
  );
  expect(duplicate._tag).toBe("Left");
  if (duplicate._tag === "Left") {
    expect(duplicate.left).toBeInstanceOf(DuplicateTagError);
  }
  const reopened = await Effect.runPromise(openStore(directory));
  expect(await Effect.runPromise(reopened.listTags())).toEqual([tag]);
  expect(await Effect.runPromise(reopened.removeTag(tag.id))).toEqual({
    deleted: true,
  });
  expect(await Effect.runPromise(reopened.listTags())).toEqual([]);
  const index = JSON.parse(
    await readFile(join(directory, "index.json"), "utf8"),
  );
  expect(index).toEqual({ version: 1, tags: [] });
});

test("keeps both tags when writes arrive together", async () => {
  const directory = await mkdtemp(join(tmpdir(), "paperman-"));
  directories.push(directory);
  const store = await Effect.runPromise(openStore(directory));

  await Promise.all([
    Effect.runPromise(store.createTag("Insurance")),
    Effect.runPromise(store.createTag("Taxes")),
  ]);

  const reopened = await Effect.runPromise(openStore(directory));
  expect(
    (await Effect.runPromise(reopened.listTags())).map((tag) => tag.name),
  ).toEqual(["Insurance", "Taxes"]);
});
