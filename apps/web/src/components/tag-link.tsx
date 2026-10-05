import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { components } from "@/lib/schema";
import { getTagIcon } from "@/lib/catalog-icons";
import { DocumentFilterLink } from "./document-filter-link";

export function TagLink({
  tag,
  search,
  ...props
}: Omit<ComponentProps<typeof DocumentFilterLink>, "children" | "filter"> & {
  tag: components["schemas"]["CatalogEntry"];
}) {
  return (
    <DocumentFilterLink
      {...props}
      search={search}
      filter={{ tag: [tag.id] }}
      aria-label={`Filter by ${tag.name}`}
    >
      <HugeiconsIcon
        icon={getTagIcon(tag)}
        size={16}
        className="size-4 text-muted-foreground"
        aria-hidden="true"
      />
      {tag.name}
    </DocumentFilterLink>
  );
}
