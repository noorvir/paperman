import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement } from "react";
import type { components } from "@/lib/schema";
import { getDocumentTags } from "@/lib/catalog-icons";
import { TagLink } from "./tag-link";
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
  compact = false,
  render,
}: {
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
  search: ComponentProps<typeof TagLink>["search"];
  compact?: boolean;
  render?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const row = useRef<HTMLDivElement>(null);
  const tags = getDocumentTags(document, catalog);
  const first = compact
    ? tags[0]
    : (tags.find((entry) => entry.id !== "invoice") ?? tags[0]);
  const secondName = tags[1]?.name;

  useLayoutEffect(() => {
    const element = row.current;
    if (!compact || !element || !secondName) return;
    const trigger = element.parentElement;
    let container = render ? trigger : trigger?.parentElement;
    while (container && getComputedStyle(container).display === "contents") {
      container = container.parentElement;
    }
    if (!container) return;
    const available = container;
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    const measure = () => {
      const link = element.querySelector("a");
      const label = link?.querySelector("span");
      if (!link || !label) return;
      const font = getComputedStyle(label);
      context.font = font.font;
      const firstWidth = link.getBoundingClientRect().width;
      const decorationWidth = firstWidth - label.getBoundingClientRect().width;
      const secondWidth =
        context.measureText(secondName).width + decorationWidth;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      const extra =
        tags.length > 2
          ? gap + context.measureText(`+${tags.length - 2}`).width + 8
          : 0;
      const style = getComputedStyle(available);
      const width =
        available.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      setVisibleCount(firstWidth + gap + secondWidth + extra <= width ? 2 : 1);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(available);
    observer.observe(element);
    const firstLink = element.querySelector("a");
    if (firstLink) observer.observe(firstLink);
    measure();
    return () => observer.disconnect();
  }, [compact, render, first?.name, secondName, tags.length]);

  if (!first) {
    if (render) return render;
    if (compact) return null;
    return (
      <span className="flex h-6 items-center text-muted-foreground">
        {document.enrichment_status === "failed"
          ? "Tagging failed"
          : "Untagged"}
      </span>
    );
  }
  const shown = compact ? tags.slice(0, visibleCount) : [first];
  const remaining = tags.length - shown.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={200}
        closeDelay={100}
        nativeButton={false}
        render={render ?? <div />}
        role={render ? "cell" : "group"}
        tabIndex={0}
        aria-label={`All ${tags.length} tags for ${document.title}`}
        className="min-w-0 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div
          ref={row}
          className="flex min-w-max flex-nowrap items-center gap-1"
        >
          {shown.map((tag) => (
            <TagLink
              key={tag.id}
              tag={tag}
              search={search}
              size={compact ? "xs" : "sm"}
              variant={compact ? "secondary" : "ghost"}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            />
          ))}
          {remaining > 0 && (
            <span
              className={`shrink-0 px-1 font-normal text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}
            >
              +{remaining}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-max min-w-48 max-w-none gap-1 data-open:animate-none"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverTitle className="px-1 pb-1 text-xs text-muted-foreground">
          Tags <span className="ml-1 tabular-nums">{tags.length}</span>
        </PopoverTitle>
        <ul className="space-y-0.5">
          {tags.map((tag) => (
            <li key={tag.id}>
              <TagLink
                tag={tag}
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
  );
}
