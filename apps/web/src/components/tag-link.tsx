import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { components } from "@/lib/schema";
import { getTagIcon } from "@/lib/catalog-icons";
import { DocumentFilterLink } from "./document-filter-link";

export function TagLink({
  tag,
  search,
  size = "sm",
  ...props
}: Omit<ComponentProps<typeof DocumentFilterLink>, "children" | "filter"> & {
  tag: components["schemas"]["CatalogEntry"];
}) {
  return (
    <DocumentFilterLink
      {...props}
      search={search}
      size={size}
      filter={{ tag: [tag.id] }}
      aria-label={`Filter by ${tag.name}`}
    >
      <HugeiconsIcon
        icon={getTagIcon(tag)}
        size={16}
        className={`${size === "xs" ? "size-3" : "size-4"} text-muted-foreground`}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap">{tag.name}</span>
    </DocumentFilterLink>
  );
}
