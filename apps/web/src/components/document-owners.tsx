import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import type { components } from "@/lib/schema";
import { OwnerAvatar, OwnerLabel } from "./collection";
import { DocumentFilterLink } from "./document-filter-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

export function DocumentOwners({
  ownerIds,
  owners,
  search,
  inline = false,
  compact = false,
  maxVisible,
}: {
  ownerIds: string[];
  owners: components["schemas"]["CatalogEntry"][];
  search: ComponentProps<typeof DocumentFilterLink>["search"];
  inline?: boolean;
  compact?: boolean;
  maxVisible?: number;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(
    maxVisible ?? ownerIds.length,
  );
  const names = useMemo(
    () =>
      ownerIds.map((id) => owners.find((owner) => owner.id === id)?.name ?? id),
    [ownerIds, owners],
  );
  useLayoutEffect(() => {
    const element = row.current;
    if (!compact || !element || maxVisible === undefined) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    const measure = () => {
      const link = element.querySelector("a");
      const label = link?.querySelector("[data-owner-name]");
      if (!link || !label) return;
      context.font = getComputedStyle(label).font;
      const decoration =
        link.getBoundingClientRect().width -
        label.getBoundingClientRect().width;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      let used = 0;
      let count = 0;
      for (const name of names.slice(0, maxVisible)) {
        const text = name.trim().split(/\s+/)[0] ?? name;
        const width = context.measureText(text).width + decoration;
        const remaining = names.length - count - 1;
        const overflow =
          remaining > 0
            ? gap + context.measureText(`+${remaining}`).width + 8
            : 0;
        if (count > 0 && used + gap + width + overflow > element.clientWidth)
          break;
        used += (count > 0 ? gap : 0) + width;
        count += 1;
      }
      setVisibleCount(count);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const link = element.querySelector("a");
    if (link) observer.observe(link);
    measure();
    return () => observer.disconnect();
  }, [compact, maxVisible, names]);
  const shown =
    maxVisible === undefined ? ownerIds : ownerIds.slice(0, visibleCount);
  const remaining = ownerIds.length - shown.length;
  return (
    <div
      ref={row}
      className={`flex min-w-0 items-start gap-1 ${compact ? "flex-nowrap" : inline ? "flex-wrap" : "flex-col"}`}
    >
      {shown.map((id) => {
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
                <span data-owner-name>{name.trim().split(/\s+/)[0]}</span>
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
      {remaining > 0 && (
        <Popover>
          <PopoverTrigger
            openOnHover
            delay={200}
            closeDelay={100}
            render={<Button variant="ghost" size="sm" />}
            className="h-8 shrink-0 px-1 font-normal text-muted-foreground"
            aria-label={`Show all ${ownerIds.length} owners`}
          >
            +{remaining}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-max max-w-xs gap-1">
            <PopoverTitle className="px-1 pb-1 text-xs text-muted-foreground">
              Owners
            </PopoverTitle>
            <DocumentOwners
              ownerIds={ownerIds}
              owners={owners}
              search={search}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
