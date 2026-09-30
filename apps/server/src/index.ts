import { RPCHandler } from "@orpc/server/fetch";
import { Config, Console, Effect } from "effect";
import { join, resolve } from "node:path";

import { createRouter } from "./router";
import { openStore } from "./store";

const program = Effect.gen(function* () {
  const port = yield* Config.integer("PORT").pipe(Config.withDefault(3000));
  const host = yield* Config.string("HOST").pipe(
    Config.withDefault("127.0.0.1"),
  );
  const dataDirectory = yield* Config.string("PAPERMAN_DATA_DIR").pipe(
    Config.withDefault(resolve(import.meta.dir, "../../../data")),
  );
  const webDirectory = resolve(import.meta.dir, "../../web/dist");
  const store = yield* openStore(dataDirectory);
  const handler = new RPCHandler(createRouter(store));

  const server = Bun.serve({
    hostname: host,
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/rpc")) {
        const result = await handler.handle(request, { prefix: "/rpc" });
        return result.response ?? new Response("Not found", { status: 404 });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
      }

      const assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const fullPath = resolve(webDirectory, `.${assetPath}`);
      if (!fullPath.startsWith(`${webDirectory}/`)) {
        return new Response("Not found", { status: 404 });
      }
      const asset = Bun.file(fullPath);
      if (await asset.exists()) {
        return new Response(asset, {
          headers: { "Cache-Control": "no-cache" },
        });
      }
      if (!assetPath.includes(".")) {
        const index = Bun.file(join(webDirectory, "index.html"));
        if (await index.exists()) {
          return new Response(index);
        }
      }
      return new Response("Not found", { status: 404 });
    },
  });

  yield* Console.log(`PaperMan listening on http://${host}:${port}`);
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      server.stop();
    }),
  );
  yield* Effect.never;
}).pipe(Effect.scoped);

await Effect.runPromise(program);
