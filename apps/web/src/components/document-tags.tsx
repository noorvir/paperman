import type { ComponentProps } from "react";
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
      {allowActions &&
        document.suggested_tags
          .filter(
            (name) =>
              !catalog.tags.some(
                (tag) => tag.name.toLowerCase() === name.toLowerCase(),
              ),
          )
          .map((name) => (
            <div key={name} className="workspace-section">
              <p className="text-xs text-muted-foreground">
                Suggested tag: {name}
              </p>
              <ActionButton
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
                Add to catalog
              </ActionButton>
            </div>
          ))}
    </>
  );
}
