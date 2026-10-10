import type { ComponentProps } from "react";
import type { components } from "@/lib/schema";
import { getDirectory } from "@/lib/directory";
import { OwnerAvatar } from "./collection";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { DocumentFilterLink } from "./document-filter-link";

export function DocumentCreators({
  document,
  catalog,
  search,
  compact = false,
}: {
  compact?: boolean;
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
  search: ComponentProps<typeof DocumentFilterLink>["search"];
}) {
  const directory = getDirectory(catalog);
  if (!document.creator_ids.length) {
    return <span className="text-muted-foreground">—</span>;
  }
  const links = document.creator_ids.map((id) => {
    const name = directory.find((entry) => entry.id === id)?.name ?? id;
    return (
      <DocumentFilterLink
        key={id}
        search={search}
        filter={{ creator: [id] }}
        aria-label={`Filter by creator: ${name}`}
        title={name}
        className="-ml-1 h-8 min-w-0 max-w-full py-1 pr-2"
      >
        <OwnerAvatar name={name} />
        <span className="truncate">{name}</span>
      </DocumentFilterLink>
    );
  });
  return (
    <div
      className={`flex min-w-0 items-start gap-1 ${compact ? "items-center" : "flex-wrap"}`}
    >
      {compact ? links.slice(0, 1) : links}
      {compact && links.length > 1 && (
        <Popover>
          <PopoverTrigger
            openOnHover
            delay={200}
            closeDelay={100}
            render={<Button variant="ghost" size="sm" />}
            className="px-1 font-normal text-muted-foreground"
            aria-label={`All ${links.length} creators for ${document.title}`}
          >
            +{links.length - 1}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64 gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <PopoverTitle className="px-1 pb-1 text-xs text-muted-foreground">
              Creator
            </PopoverTitle>
            {links}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
