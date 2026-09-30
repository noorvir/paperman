import { Database } from "bun:sqlite";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { ScanBatch, Tag } from "@paperman/api";
import { Effect } from "effect";

export class DuplicateTagError extends Error {}

export function openStore(dataDirectory: string) {
  const inboxDirectory = join(dataDirectory, "inbox");
  const initialize = Effect.tryPromise({
    try: async () => {
      await mkdir(inboxDirectory, { recursive: true });
      const db = new Database(join(dataDirectory, "paperman.sqlite"), {
        create: true,
      });
      db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    },
    catch: (cause) => new Error("Could not open PaperMan storage", { cause }),
  });

  return Effect.map(initialize, (db) => ({
    inboxDirectory,
    close: () => db.close(),
    listInbox: () =>
      Effect.tryPromise({
        try: async (): Promise<ScanBatch[]> => {
          const entries = await readdir(inboxDirectory, {
            withFileTypes: true,
          });
          const pdfs = entries.filter(
            (entry) =>
              entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"),
          );
          const batches = await Promise.all(
            pdfs.map(async (entry) => {
              const details = await stat(join(inboxDirectory, entry.name));
              return {
                name: entry.name,
                sizeBytes: details.size,
                modifiedAt: details.mtime.toISOString(),
              };
            }),
          );
          return batches.sort((a, b) =>
            b.modifiedAt.localeCompare(a.modifiedAt),
          );
        },
        catch: (cause) => new Error("Could not read the scan inbox", { cause }),
      }),
    listTags: () =>
      Effect.try({
        try: (): Tag[] =>
          db
            .query<Tag, []>(
              "SELECT id, name, created_at AS createdAt FROM tags ORDER BY name COLLATE NOCASE",
            )
            .all(),
        catch: (cause) => new Error("Could not read tags", { cause }),
      }),
    createTag: (name: string) =>
      Effect.try({
        try: (): Tag => {
          const tag = {
            id: randomUUID(),
            name,
            createdAt: new Date().toISOString(),
          };
          const result = db
            .query(
              "INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)",
            )
            .run(tag.id, tag.name, tag.createdAt);
          if (result.changes === 0) {
            throw new DuplicateTagError("This tag already exists");
          }
          return tag;
        },
        catch: (cause) =>
          cause instanceof DuplicateTagError
            ? cause
            : new Error("Could not create tag", { cause }),
      }),
    removeTag: (id: string) =>
      Effect.try({
        try: () => ({
          deleted:
            db.query("DELETE FROM tags WHERE id = ?").run(id).changes > 0,
        }),
        catch: (cause) => new Error("Could not remove tag", { cause }),
      }),
  }));
}
