import { ORPCError, implement } from "@orpc/server";
import { contract } from "@paperman/api";
import { Effect } from "effect";

import { DuplicateTagError, openStore } from "./store";

type Store = Effect.Effect.Success<ReturnType<typeof openStore>>;

export function createRouter(store: Store) {
  const os = implement(contract);

  return os.router({
    health: os.health.handler(() =>
      Effect.runPromise(Effect.succeed({ status: "ok" as const })),
    ),
    inbox: {
      list: os.inbox.list.handler(() => Effect.runPromise(store.listInbox())),
    },
    tags: {
      list: os.tags.list.handler(() => Effect.runPromise(store.listTags())),
      create: os.tags.create.handler(async ({ input }) => {
        const name = input.name.trim();
        if (!name) {
          throw new ORPCError("BAD_REQUEST", { message: "Enter a tag name" });
        }
        const result = await Effect.runPromise(
          Effect.either(store.createTag(name)),
        );
        if (result._tag === "Left") {
          if (result.left instanceof DuplicateTagError) {
            throw new ORPCError("CONFLICT", { message: result.left.message });
          }
          throw result.left;
        }
        return result.right;
      }),
      remove: os.tags.remove.handler(({ input }) =>
        Effect.runPromise(store.removeTag(input.id)),
      ),
    },
  });
}
