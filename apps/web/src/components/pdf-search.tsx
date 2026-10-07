import { useState } from "react";
import { useSearch } from "@embedpdf/plugin-search/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export function PdfSearch({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const { state, provides } = useSearch(documentId);
  const [query, setQuery] = useState(state.query);
  const [failed, setFailed] = useState(false);
  let status = "";
  if (failed) {
    status = "Search failed. Try again.";
  } else if (state.loading) {
    status = "Searching";
  } else if (state.query) {
    status = state.total
      ? `${state.activeResultIndex + 1} of ${state.total}`
      : "No matches";
  }

  return (
    <form
      className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5"
      aria-label="Search PDF text"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        setFailed(false);
        provides?.searchAllPages(query.trim()).wait(
          () => {},
          () => setFailed(true),
        );
      }}
    >
      <Input
        autoFocus
        aria-label="Find in PDF"
        placeholder="Find in PDF"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className="min-w-24 flex-1 basis-32 bg-background"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!query.trim() || state.loading}
      >
        Find
      </Button>
      <span
        role="status"
        className="px-1 text-xs text-muted-foreground tabular-nums"
      >
        {status}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous match"
        disabled={!state.total || state.loading}
        onClick={() => provides?.previousResult()}
      >
        <HugeiconsIcon icon={ArrowUp01Icon} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next match"
        disabled={!state.total || state.loading}
        onClick={() => provides?.nextResult()}
      >
        <HugeiconsIcon icon={ArrowDown01Icon} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Close PDF search"
        onClick={onClose}
      >
        <HugeiconsIcon icon={Cancel01Icon} />
      </Button>
    </form>
  );
}
