import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { documentSearch } from "@/lib/queries";
import { FileIcon } from "./file-icon";
import { DocumentTable } from "./document-table";
import { Button, buttonVariants } from "./ui/button";
import { CollectionFooter, ScanStatus } from "./collection";
import { statuses } from "./overview-summary";

export function OverviewWork({
  work,
  recent,
  catalog,
  filtered,
  onReset,
  onPage,
}: {
  work: components["schemas"]["PipelinePage"];
  recent: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
  filtered: boolean;
  onReset: () => void;
  onPage: (page: number) => void;
}) {
  const title = filtered
    ? statuses.find((item) => item.id === work.status)?.label
    : "Recent documents";
  const documents = filtered
    ? work.items.flatMap((item) =>
        item.kind === "document" ? [item.document] : [],
      )
    : recent;
  const scans = filtered
    ? work.items.filter((item) => item.kind === "scan")
    : [];
  let noun = work.status === "complete" ? "documents" : "items";
  if (work.total === 1) {
    noun = noun.slice(0, -1);
  }
  return (
    <section
      id="overview-work"
      aria-labelledby="overview-work-heading"
      className="flex h-[32rem] min-w-0 flex-col lg:h-full"
    >
      <header className="mb-3 flex h-7 shrink-0 items-center justify-between gap-3">
        <h2
          id="overview-work-heading"
          className="workspace-title"
          aria-live="polite"
        >
          {title}
        </h2>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Recent documents
          </Button>
        ) : (
          <Link
            to="/documents"
            search={{}}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View all <HugeiconsIcon icon={ArrowRight01Icon} />
          </Link>
        )}
      </header>
      <div
        key={filtered ? `${work.status}-${work.page}` : "recent"}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        tabIndex={0}
        role="region"
        aria-label={`${title} list`}
      >
        {scans.length > 0 && (
          <ul className="divide-y">
            {scans.map((item) => (
              <li key={item.id}>
                <Link
                  to="/scans/$scanId"
                  params={{ scanId: item.id }}
                  search={{ preview: true }}
                  className="flex h-14 items-center gap-3 hover:bg-muted/40 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <FileIcon filename={item.filename} />
                  <div className="min-w-0 flex-1">
                    <p className="document-link">{item.title}</p>
                    <p className="document-caption">{item.detail}</p>
                  </div>
                  <ScanStatus status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {documents.length > 0 && (
          <DocumentTable
            documents={documents}
            catalog={catalog}
            search={documentSearch.parse({})}
            selectedId={undefined}
          />
        )}
        {(filtered ? work.total === 0 : recent.length === 0) && (
          <p className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
            {filtered
              ? emptyMessages[work.status]
              : "Your filed documents will appear here."}
          </p>
        )}
      </div>
      <div className="h-12 shrink-0">
        {filtered ? (
          <CollectionFooter {...work} noun={noun} count={work.items.length}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous results page"
              disabled={work.page === 1}
              onClick={() => onPage(work.page - 1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next results page"
              disabled={work.page === work.pages}
              onClick={() => onPage(work.page + 1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </CollectionFooter>
        ) : (
          <div className="border-t pt-3 text-xs text-muted-foreground">
            {recent.length} recent documents
          </div>
        )}
      </div>
    </section>
  );
}

const emptyMessages = {
  queued: "No items are waiting to be processed.",
  running: "No items are being processed.",
  review: "No scans need review.",
  complete: "No documents have finished processing.",
  failed: "No failed scans or documents.",
};
