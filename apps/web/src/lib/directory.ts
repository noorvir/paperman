import type { components } from "./schema";

export function getDirectory(catalog: components["schemas"]["Catalog"]) {
  return [...catalog.owners, ...catalog.creators]
    .filter((entry) => entry.id !== "unknown")
    .sort((a, b) => a.name.localeCompare(b.name));
}
