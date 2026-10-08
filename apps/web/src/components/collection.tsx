import type { FormEvent, ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { components } from "@/lib/schema";

export function Collection({
  toolbar,
  children,
  footer,
  preview,
}: {
  toolbar: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  preview?: ReactNode;
}) {
  return (
    <section className="collection">
      <div className="collection-toolbar">{toolbar}</div>
      <div className="collection-content">
        <div className="collection-body">{children}</div>
        {preview}
      </div>
      {footer}
    </section>
  );
}

export function SearchField({
  value,
  placeholder,
  onSearch,
}: {
  value: string;
  placeholder: string;
  onSearch: (query: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSearch(String(data.get("q") ?? "").trim());
  }
  return (
    <form
      className="collection-search"
      key={value}
      onSubmit={submit}
      role="search"
    >
      <HugeiconsIcon
        icon={Search01Icon}
        size={16}
        className="shrink-0 text-muted-foreground"
      />
      <Input
        name="q"
        aria-label={placeholder}
        placeholder={placeholder}
        defaultValue={value}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear search"
          onClick={() => onSearch("")}
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      )}
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}

export function CollectionFooter({
  page,
  pages,
  total,
  count,
  noun,
  children,
}: {
  page: number;
  pages: number;
  total: number;
  count: number;
  noun: string;
  children: ReactNode;
}) {
  const first = total === 0 ? 0 : (page - 1) * 25 + 1;
  const last = total === 0 ? 0 : first + count - 1;
  return (
    <footer className="collection-footer">
      <span className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {first}–{last}
        </span>{" "}
        of {total} {noun}
      </span>
      <nav aria-label="Pagination" className="flex items-center gap-2">
        <span className="mr-2 text-xs text-muted-foreground">
          Page {page} of {pages}
        </span>
        {children}
      </nav>
    </footer>
  );
}

export function OwnerLabel({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <OwnerAvatar name={name} />
      <span>{name}</span>
    </span>
  );
}

export function OwnerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary text-[8px] font-medium text-secondary-foreground ring-1 ring-inset ring-border"
    >
      {initials}
    </span>
  );
}

export function ScanStatus({
  status,
}: {
  status: components["schemas"]["Scan"]["status"];
}) {
  const labels = {
    queued: "Queued",
    running: "Processing",
    review: "Needs review",
    failed: "Failed",
    complete: "Filed",
  };
  return (
    <Badge
      variant={
        status === "complete"
          ? "success"
          : status === "failed"
            ? "destructive"
            : status === "review" || status === "running"
              ? "attention"
              : "secondary"
      }
    >
      <span className="size-1.5 rounded-full bg-current" />
      {labels[status]}
    </Badge>
  );
}
