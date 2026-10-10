import type { ComponentProps } from "react";
import type { components } from "@/lib/schema";
import { OwnerAvatar, OwnerLabel } from "./collection";
import { DocumentFilterLink } from "./document-filter-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function DocumentOwners({
  ownerIds,
  owners,
  search,
  inline = false,
  compact = false,
}: {
  ownerIds: string[];
  owners: components["schemas"]["CatalogEntry"][];
  search: ComponentProps<typeof DocumentFilterLink>["search"];
  inline?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-start gap-1 ${compact ? "flex-nowrap" : inline ? "flex-wrap" : "flex-col"}`}
    >
      {ownerIds.map((id) => {
        const name = owners.find((owner) => owner.id === id)?.name ?? id;
        if (compact) {
          return (
            <Tooltip key={id}>
              <TooltipTrigger
                render={
                  <DocumentFilterLink
                    search={search}
                    filter={{ owner: [id] }}
                    aria-label={`Filter by owner: ${name}`}
                    className="h-8 shrink-0 gap-1.5 px-1"
                  />
                }
              >
                <OwnerAvatar name={name} />
                <span>{name.trim().split(/\s+/)[0]}</span>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
          );
        }
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
