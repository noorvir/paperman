import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { TagSchema } from "@paperman/api";
import type { ScanBatch, Tag } from "@paperman/api";
import { Effect, Schema } from "effect";

const IndexSchema = Schema.Struct({
  version: Schema.Literal(1),
  tags: Schema.Array(TagSchema),
});

type Index = typeof IndexSchema.Type;

export class DuplicateTagError extends Error {}

export function openStore(dataDirectory: string) {
  const inboxDirectory = join(dataDirectory, "inbox");
  const indexPath = join(dataDirectory, "index.json");
  let pending = Promise.resolve();

  async function readIndex(): Promise<Index> {
    try {
      const content = await readFile(indexPath, "utf8");
      return Schema.decodeUnknownSync(IndexSchema)(JSON.parse(content));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return { version: 1, tags: [] };
      }
      throw error;
    }
  }

  async function writeIndex(index: Index) {
    const temporaryPath = `${indexPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(index, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, indexPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  function changeIndex<Result>(change: (index: Index) => Promise<Result>) {
    const operation = pending.then(async () => change(await readIndex()));
    pending = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  return Effect.as(
    Effect.tryPromise({
      try: () => mkdir(inboxDirectory, { recursive: true }),
      catch: (cause) => new Error("Could not open PaperMan storage", { cause }),
    }),
    {
      inboxDirectory,
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
          catch: (cause) =>
            new Error("Could not read the scan inbox", { cause }),
        }),
      listTags: () =>
        Effect.tryPromise({
          try: async (): Promise<Tag[]> => {
            const index = await readIndex();
            return [...index.tags].sort((a, b) => a.name.localeCompare(b.name));
          },
          catch: (cause) => new Error("Could not read tags", { cause }),
        }),
      createTag: (name: string) =>
        Effect.tryPromise({
          try: () =>
            changeIndex(async (index): Promise<Tag> => {
              if (
                index.tags.some(
                  (tag) => tag.name.toLowerCase() === name.toLowerCase(),
                )
              ) {
                throw new DuplicateTagError("This tag already exists");
              }
              const tag = {
                id: randomUUID(),
                name,
                createdAt: new Date().toISOString(),
              };
              await writeIndex({ version: 1, tags: [...index.tags, tag] });
              return tag;
            }),
          catch: (cause) =>
            cause instanceof DuplicateTagError
              ? cause
              : new Error("Could not create tag", { cause }),
        }),
      removeTag: (id: string) =>
        Effect.tryPromise({
          try: () =>
            changeIndex(async (index) => {
              const tags = index.tags.filter((tag) => tag.id !== id);
              if (tags.length === index.tags.length) {
                return { deleted: false };
              }
              await writeIndex({ version: 1, tags });
              return { deleted: true };
            }),
          catch: (cause) => new Error("Could not remove tag", { cause }),
        }),
    },
  );
}
