import type { ComponentProps } from "react";
import type { components } from "@/lib/schema";
import { OwnerLabel } from "./collection";
import { DocumentFilterLink } from "./document-filter-link";

export function DocumentOwners({
  ownerIds,
  owners,
  search,
  inline = false,
}: {
  ownerIds: string[];
  owners: components["schemas"]["CatalogEntry"][];
  search: ComponentProps<typeof DocumentFilterLink>["search"];
  inline?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-start gap-1 ${inline ? "flex-wrap" : "flex-col"}`}
    >
      {ownerIds.map((id) => {
        const name = owners.find((owner) => owner.id === id)?.name ?? id;
        return (
          <DocumentFilterLink
            key={id}
            search={search}
            filter={{ owner: [id] }}
            aria-label={`Filter by owner: ${name}`}
            className="-ml-1 h-8 py-1 pr-2"
          >
            <OwnerLabel name={name} />
          </DocumentFilterLink>
        );
      })}
    </div>
  );
}
