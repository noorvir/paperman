import {
  deepEqual,
  redirect,
  stringifySearchWith,
  type HistoryState,
} from "@tanstack/react-router";
import type { z } from "zod";
import type { Access } from "./auth/access";

type Preference = {
  name: string;
  schema: z.ZodType<Record<string, unknown>>;
  legacy?: { key: string; field: string };
  retain?: boolean;
};
type Context = { access: Access };
const stringifySearch = stringifySearchWith(JSON.stringify);

declare module "@tanstack/react-router" {
  interface HistoryState {
    preferenceScopes?: string[];
  }
}

/** Keep absence distinct from an explicit default until preferences are restored. */
function explicitSearch<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return {
    parse: (input: Record<string, unknown>) => {
      const parsed = schema.partial().parse(input);
      for (const key in parsed) {
        if (!(key in input)) {
          delete parsed[key];
        }
      }

      return parsed;
    },
  };
}

/** Restore before loading a route; cache only committed URL state. */
export function persistedSearch<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  ...preferences: Preference[]
) {
  const defaults = schema.parse({});
  function save({
    search,
    context,
  }: {
    search: Record<string, unknown>;
    context: Context;
  }) {
    for (const preference of preferences) {
      try {
        localStorage.setItem(
          storageKey(preference.name, context.access),
          JSON.stringify(preference.schema.parse(search)),
        );
      } catch {
        // The URL remains usable when browser storage is unavailable.
      }
    }
  }

  return {
    validateSearch: explicitSearch(schema),
    // Local storage must be read before loaders run, including on first entry.
    ssr: false,
    beforeLoad: ({
      location,
      context,
      cause,
    }: {
      location: {
        pathname: string;
        search: Record<string, unknown>;
        hash: string;
        state: HistoryState;
      };
      context: Context;
      cause: "preload" | "enter" | "stay";
    }) => {
      const scopes = preferences.map((preference) =>
        storageKey(preference.name, context.access),
      );
      // History entries must not restore newer saved values over omitted defaults.
      const resolved = location.state.preferenceScopes ?? [];
      const search = { ...location.search };
      for (const preference of preferences) {
        let saved = {};
        if (
          !resolved.includes(storageKey(preference.name, context.access)) &&
          (cause !== "stay" || preference.retain)
        ) {
          saved = read(preference, context.access);
        }
        Object.assign(
          search,
          preference.schema.parse({ ...saved, ...location.search }),
        );
      }
      for (const [key, value] of Object.entries(defaults)) {
        if (deepEqual(search[key], value)) {
          delete search[key];
        }
      }

      if (
        stringifySearch(search) !== stringifySearch(location.search) ||
        scopes.some((scope) => !resolved.includes(scope))
      ) {
        throw redirect({
          href: `${location.pathname}${stringifySearch(search)}${location.hash ? `#${location.hash}` : ""}`,
          replace: true,
          state: {
            ...location.state,
            preferenceScopes: [...new Set([...resolved, ...scopes])],
          },
        });
      }
    },
    onEnter: save,
    onStay: save,
  };
}

function read({ name, schema, legacy }: Preference, access: Access) {
  try {
    const saved = localStorage.getItem(storageKey(name, access));
    let value: unknown = saved ? JSON.parse(saved) : {};
    if (!saved && legacy) {
      const previous = localStorage.getItem(legacy.key);
      if (previous) {
        value = { [legacy.field]: JSON.parse(previous) };
      }
    }

    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Corrupt or blocked storage falls back to the route defaults.
  }

  return {};
}

function storageKey(name: string, access: Access) {
  const scope =
    access.state === "authenticated" ? `user:${access.userId}` : access.state;
  return `paperman.preferences.v1:${scope}:${name}`;
}
