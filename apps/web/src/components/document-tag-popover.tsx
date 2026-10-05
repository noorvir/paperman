import { useState } from "react";
import type { ComponentProps } from "react";
import type { components } from "@/lib/schema";
import { getDocumentTags } from "@/lib/catalog-icons";
import { TagLink } from "./tag-link";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

export function DocumentTagPopover({
  document,
  catalog,
  search,
}: {
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
  search: ComponentProps<typeof TagLink>["search"];
}) {
  const [open, setOpen] = useState(false);
  const tags = getDocumentTags(document, catalog);
  const tag = tags.find((entry) => entry.id !== "invoice") ?? tags[0];
  if (!tag) {
    return (
      <span className="flex h-6 items-center text-muted-foreground">
        {document.enrichment_status === "failed"
          ? "Tagging failed"
          : "Untagged"}
      </span>
    );
  }
  return (
    <div className="relative flex h-6 items-center gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          openOnHover
          delay={200}
          closeDelay={100}
          nativeButton={false}
          render={<TagLink tag={tag} search={search} />}
          role="link"
          className="-ml-1"
          onClick={() => setOpen(false)}
        />
        {tags.length > 1 && (
          <PopoverTrigger
            openOnHover
            delay={200}
            closeDelay={100}
            render={<Button variant="ghost" size="sm" />}
            className="px-1 font-normal text-muted-foreground"
            aria-label={`All ${tags.length} tags for ${document.title}`}
          >
            +{tags.length - 1}
          </PopoverTrigger>
        )}
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-48 gap-1 data-open:animate-none"
          onClick={(event) => event.stopPropagation()}
        >
          <PopoverTitle className="px-1 pb-1 text-xs text-muted-foreground">
            Tags <span className="ml-1 tabular-nums">{tags.length}</span>
          </PopoverTitle>
          <ul className="space-y-0.5">
            {tags.map((entry) => (
              <li key={entry.id}>
                <TagLink
                  tag={entry}
                  search={search}
                  className="w-full"
                  onClick={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
          {document.enrichment_status === "failed" && (
            <p className="px-1 pt-1 text-destructive">Tagging failed</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
