import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import { z } from "zod";
import { persistedSearch } from "../src/lib/search-preferences";
import type { Access } from "../src/lib/auth/access";

const schema = z.object({
  q: z.string().default(""),
  sort: z.enum(["asc", "desc"]).default("asc"),
  columns: z.array(z.string()).default(["title", "owner"]),
});
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});

function app(access: Access, entry = "/documents") {
  const root = createRootRouteWithContext<{ access: Access }>()();
  const documents = createRoute({
    getParentRoute: () => root,
    path: "/documents",
    ...persistedSearch(schema, { name: "documents", schema }),
    loaderDeps: ({ search }) => schema.parse(search),
    loader: ({ deps }) => deps,
  });
  const other = createRoute({ getParentRoute: () => root, path: "/other" });
  return createRouter({
    routeTree: root.addChildren([documents, other]),
    history: createMemoryHistory({ initialEntries: [entry] }),
    context: { access },
    isServer: false,
    origin: "http://localhost",
  });
}

test("URL restoration, committed navigation, preload, and account scopes", async () => {
  storage.clear();
  const access: Access = { state: "disabled" };
  const key = "paperman.preferences.v1:disabled:documents";
  storage.set(
    key,
    JSON.stringify({ q: "stored", sort: "desc", columns: ["title"] }),
  );
  const router = app(access, "/documents?q=explicit#results");
  await router.load();
  assert.deepEqual(router.state.matches.at(-1)?.loaderData, {
    q: "explicit",
    sort: "desc",
    columns: ["title"],
  });
  assert.equal(router.state.location.hash, "results");
  assert.equal(router.history.length, 1);
  assert.equal(JSON.parse(storage.get(key) ?? "{}").q, "explicit");
  assert.equal(router.state.location.search.sort, "desc");
  await router.navigate({ href: "/documents?q=&sort=asc&columns=%5B%5D" });
  assert.equal(router.state.location.search.q, undefined);
  assert.equal(router.state.location.search.sort, undefined);
  assert.deepEqual(JSON.parse(storage.get(key) ?? "{}"), {
    q: "",
    sort: "asc",
    columns: [],
  });
  const reloaded = app(access);
  await reloaded.load();
  assert.deepEqual(reloaded.state.matches.at(-1)?.loaderData, {
    q: "",
    sort: "asc",
    columns: [],
  });
  await router.preloadRoute({
    to: "/documents",
    search: { q: "hover", sort: "desc" },
  });
  assert.equal(JSON.parse(storage.get(key) ?? "{}").q, "");
  const member: Access = {
    state: "authenticated",
    userId: "member",
    name: "Member",
    applicationRole: "user",
    organizationRole: "member",
    godMode: false,
    impersonating: false,
  };
  const separate = app(member);
  await separate.load();
  assert.deepEqual(separate.state.matches.at(-1)?.loaderData, schema.parse({}));
  assert.equal(separate.state.location.searchStr, "");
  assert.equal(JSON.parse(storage.get(key) ?? "{}").columns.length, 0);
});

test("empty and default URL values stay cleared across navigation and history", async () => {
  storage.clear();
  const key = "paperman.preferences.v1:disabled:documents";
  storage.set(
    key,
    JSON.stringify({ q: "old", sort: "desc", columns: ["title"] }),
  );
  const router = app(
    { state: "disabled" },
    "/documents?q=&sort=asc&columns=%5B%22title%22%2C%22owner%22%5D#results",
  );
  await router.load();
  assert.equal(router.state.location.href, "/documents#results");
  assert.equal(router.history.length, 1);
  const clearedEntry = { ...router.history.location };
  await router.navigate({
    to: "/documents",
    search: { q: "active", sort: "desc" },
  });
  assert.equal(router.state.location.search.q, "active");
  await router.navigate({ to: "/other" });
  router.history.replace(clearedEntry.href, clearedEntry.state);
  await router.load();
  assert.equal(router.state.location.searchStr, "");
  assert.deepEqual(router.state.matches.at(-1)?.loaderData, schema.parse({}));
  assert.equal(JSON.parse(storage.get(key) ?? "{}").q, "");
  await router.navigate({ to: "/documents", search: schema.parse({}) });
  assert.equal(router.state.location.searchStr, "");
});

test("malformed or unavailable storage does not break URL state", async () => {
  const key = "paperman.preferences.v1:disabled:documents";
  for (const value of ["{broken", JSON.stringify({ sort: "invalid" })]) {
    storage.set(key, value);
    const router = app({ state: "disabled" }, "/documents?q=valid");
    await router.load();
    assert.deepEqual(
      router.state.matches.at(-1)?.loaderData,
      schema.parse({ q: "valid" }),
    );
  }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage blocked");
    },
  });
  const router = app({ state: "disabled" }, "/documents?sort=desc");
  await router.load();
  assert.deepEqual(
    router.state.matches.at(-1)?.loaderData,
    schema.parse({ sort: "desc" }),
  );
});
