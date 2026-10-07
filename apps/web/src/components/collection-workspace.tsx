import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createLink } from "@tanstack/react-router";
import { TableRow } from "./ui/table";
import { cn } from "cn";

export function CollectionWorkspace({
  full,
  items,
  selectedId,
  onNavigate,
  children,
}: {
  full: boolean;
  items: { id: string }[];
  selectedId: string | undefined;
  onNavigate: (id: string, preview: boolean) => Promise<void>;
  children: ReactNode;
}) {
  const [lastSelectedId, setLastSelectedId] = useState(selectedId);
  if (selectedId !== undefined && selectedId !== lastSelectedId) {
    setLastSelectedId(selectedId);
  }
  const activeId = selectedId ?? lastSelectedId;

  function navigateItems(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      full ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(target instanceof Element) ||
      !target.closest(".collection-content") ||
      target.closest(
        'input, textarea, button, [contenteditable="true"], [role="combobox"], [role="menu"], [role="listbox"], .pdf-preview',
      ) ||
      (target.closest("a") && !target.closest("[data-collection-link]"))
    ) {
      return;
    }
    const focusedId = target
      .closest("[data-collection-link]")
      ?.getAttribute("data-item-id");
    const index = items.findIndex(
      (item) => item.id === (focusedId ?? activeId),
    );
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = Math.min(index + 1, items.length - 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = Math.max(index - 1, 0);
    } else if (event.key !== "Enter") {
      return;
    }
    const item = items[next];
    if (!item) {
      return;
    }
    event.preventDefault();
    const preview = event.key !== "Enter";
    void onNavigate(item.id, preview).then(() => {
      if (preview) {
        const link = document.getElementById(`collection-item-${item.id}`);
        link?.focus({ preventScroll: true });
        link?.scrollIntoView({ block: "nearest" });
      }
    });
  }
  return (
    <CollectionSelectionContext value={activeId}>
      <div
        className="collection-workspace @container/library"
        data-full={full}
        onKeyDown={navigateItems}
        onClickCapture={(event) => {
          if (
            full ||
            !selectedId ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.shiftKey ||
            !(event.target instanceof Element)
          ) {
            return;
          }
          const link = event.target.closest("[data-collection-link]");
          if (link?.getAttribute("data-item-id") === selectedId) {
            event.preventDefault();
            event.stopPropagation();
            void onNavigate(selectedId, false);
          }
        }}
      >
        {children}
      </div>
    </CollectionSelectionContext>
  );
}

export const CollectionSelectionContext = createContext<string | undefined>(
  undefined,
);

export function CollectionRow({
  itemId,
  ...props
}: ComponentProps<typeof TableRow> & { itemId: string }) {
  const activeId = useContext(CollectionSelectionContext);
  return (
    <TableRow
      {...props}
      data-state={activeId === itemId ? "selected" : undefined}
      className="cursor-pointer has-[[data-collection-link]:focus-visible]:bg-muted"
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("a, button")
        ) {
          return;
        }
        const link = event.currentTarget.querySelector<HTMLAnchorElement>(
          "[data-collection-link]",
        );
        link?.focus({ preventScroll: true });
        link?.click();
      }}
    />
  );
}

export const CollectionLink = createLink(function CollectionAnchor({
  itemId,
  selected,
  preview = true,
  className,
  ...props
}: ComponentProps<"a"> & {
  itemId: string;
  selected: boolean;
  preview?: boolean;
}) {
  const activeId = useContext(CollectionSelectionContext);
  return (
    <a
      {...props}
      id={`collection-item-${itemId}`}
      data-item-id={itemId}
      data-collection-link
      aria-haspopup={preview ? "dialog" : undefined}
      aria-expanded={preview ? selected : undefined}
      aria-current={activeId === itemId ? "true" : undefined}
      className={cn("document-link outline-none hover:no-underline", className)}
    />
  );
});
