import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { getDocumentTags } from "@/lib/catalog-icons";
import type { components } from "@/lib/schema";
import { saveEntry } from "@/lib/actions";
import { ActionButton } from "./page";
import { TagLink } from "./tag-link";

export function DocumentTags({
  document,
  catalog,
  allowActions,
  search,
}: {
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
  allowActions: boolean;
  search: ComponentProps<typeof TagLink>["search"];
}) {
  const tags = getDocumentTags(document, catalog);
  const knownNames = new Set(
    catalog.tags.map((tag) => formatTagName(tag.name).toLowerCase()),
  );
  const suggestions: string[] = [];
  for (const value of document.suggested_tags) {
    const name = formatTagName(value);
    const key = name.toLowerCase();
    if (!name || knownNames.has(key)) {
      continue;
    }
    knownNames.add(key);
    suggestions.push(name);
  }
  return (
    <>
      <section className="workspace-section border-y py-4">
        <h2 className="workspace-title">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagLink
              key={tag.id}
              tag={tag}
              search={search}
              className="bg-muted px-2"
            />
          ))}
          {tags.length === 0 && (
            <p className="workspace-description">No tags assigned.</p>
          )}
        </div>
      </section>
      {allowActions && suggestions.length > 0 && (
        <section className="workspace-section">
          <h3 className="text-xs font-medium">Suggested tags</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <ActionButton
                key={name}
                variant="secondary"
                size="sm"
                className="max-w-full gap-1.5 rounded-full px-2 font-normal"
                aria-label={`Add ${name} to catalog`}
                title={`Add ${name} to catalog`}
                action={() =>
                  saveEntry({
                    data: {
                      kind: "tags",
                      id: "",
                      value: { name, aliases: [] },
                    },
                  })
                }
              >
                <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
                <span className="truncate">{name}</span>
              </ActionButton>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function formatTagName(value: string) {
  const name = value.replace(/_/g, " ").trim().replace(/\s+/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
