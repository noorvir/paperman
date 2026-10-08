import { useLiveData } from "@/hooks/use-live-data";
import {
  createFileRoute,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload04Icon } from "@hugeicons/core-free-icons";
import {
  getDashboard,
  getCatalog,
  getDocuments,
  getScans,
  documentSearch,
  scanSearch,
  dashboardSearch,
} from "@/lib/queries";
import { PageHeader } from "@/components/page";
import { ScanStatus } from "@/components/collection";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { OverviewSummary } from "@/components/overview-summary";
import { OverviewWork } from "@/components/overview-work";
import { DocumentVerificationBadge } from "@/components/document-verification-badge";

export const Route = createFileRoute("/")({
  validateSearch: dashboardSearch,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search: { status, page } }) => ({ status, page }),
  loader: async ({ deps }) => {
    const [state, documents, review, failed, catalog] = await Promise.all([
      getDashboard({ data: deps }),
      getDocuments({ data: documentSearch.parse({}) }),
      getScans({ data: scanSearch.parse({ status: "review" }) }),
      getScans({ data: scanSearch.parse({ status: "failed" }) }),
      getCatalog(),
    ]);
    return {
      state,
      selectedStatus: deps.status,
      catalog,
      documents,
      attention: [...failed.items, ...review.items].slice(0, 5),
    };
  },
  component: Overview,
  // Retain the current layout and results until the selected status is ready.
  pendingMs: Infinity,
});

function Overview() {
  useLiveData();
  const { state, documents, attention, catalog, selectedStatus } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const unverifiedCount = state.counts.unverified ?? 0;
  const needsAttention =
    attention.length > 0 ||
    unverifiedCount > 0 ||
    !state.worker_online ||
    state.worker?.status === "error" ||
    !state.model_configured ||
    !state.ocr_available ||
    state.enrichment_failed > 0;
  return (
    <div className="workspace-page max-w-6xl lg:min-h-0 lg:flex-1 lg:shrink">
      <div className="flex shrink-0 flex-col gap-5 border-b pb-3">
        <PageHeader
          title="Overview"
          description="A clear view of your paperwork."
        >
          <Link to="/scans/upload" className={buttonVariants()}>
            <HugeiconsIcon icon={Upload04Icon} /> Upload scan
          </Link>
        </PageHeader>
        <OverviewSummary
          counts={state.counts}
          status={search.status}
          onSelect={(status) =>
            void navigate({
              search: {
                ...search,
                status: status === search.status ? undefined : status,
                page: 1,
              },
              resetScroll: false,
            })
          }
        />
      </div>
      <div className="grid items-start gap-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[minmax(0,1fr)]">
        <OverviewWork
          work={state.pipeline_items}
          recent={documents.items.slice(0, 8)}
          catalog={catalog}
          filtered={selectedStatus !== undefined}
          onReset={() =>
            void navigate({
              search: { ...search, status: undefined, page: 1 },
              resetScroll: false,
            })
          }
          onPage={(page) =>
            void navigate({ search: { ...search, page }, resetScroll: false })
          }
        />
        <aside
          aria-labelledby="attention-heading"
          className="flex h-[32rem] min-w-0 flex-col lg:h-full"
        >
          <h2
            id="attention-heading"
            className="workspace-title mb-3 flex h-7 shrink-0 items-center"
          >
            Needs attention
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            <div className="space-y-3">
              {!state.worker_online && (
                <Alert variant="destructive">
                  <AlertTitle>Worker is offline</AlertTitle>
                  <AlertDescription>
                    New scans will wait in the inbox until the worker starts.
                  </AlertDescription>
                </Alert>
              )}
              {state.worker?.status === "error" && (
                <Alert variant="destructive">
                  <AlertTitle>Worker needs attention</AlertTitle>
                  <AlertDescription>{state.worker.message}</AlertDescription>
                </Alert>
              )}
              {!state.model_configured && (
                <Alert>
                  <AlertTitle>Connect a model</AlertTitle>
                  <AlertDescription>
                    <Link to="/settings" className="underline">
                      Set the endpoint and model name
                    </Link>{" "}
                    to enable document analysis.
                  </AlertDescription>
                </Alert>
              )}
              {!state.ocr_available && (
                <Alert variant="destructive">
                  <AlertTitle>OCR is unavailable</AlertTitle>
                  <AlertDescription>
                    Install Tesseract on the worker host before processing
                    scans.
                  </AlertDescription>
                </Alert>
              )}
              {state.enrichment_failed > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>
                    Tagging failed for {state.enrichment_failed} documents
                  </AlertTitle>
                  <AlertDescription>
                    <Link
                      to="/documents"
                      search={{ status: "failed" }}
                      className="underline"
                    >
                      Open affected documents
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="divide-y">
              {attention.map((scan) => (
                <Link
                  key={scan.id}
                  to="/scans/$scanId"
                  params={{ scanId: scan.id }}
                  search={{ preview: true }}
                  className="flex flex-col items-start gap-2 py-4 hover:bg-accent/30"
                >
                  <ScanStatus status={scan.status} />
                  <p className="max-w-full truncate text-xs font-medium">
                    {scan.original_name}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {scan.status === "review"
                      ? "Check the document groups and filing details."
                      : scan.history.at(-1)?.message}
                  </p>
                  <span className="text-xs font-medium">
                    {scan.status === "review"
                      ? "Review scan"
                      : "View and retry"}{" "}
                    →
                  </span>
                </Link>
              ))}
            </div>
            {unverifiedCount > 0 && (
              <section
                className="space-y-2 border-t py-4"
                aria-labelledby="verification-heading"
              >
                <h3 id="verification-heading" className="text-xs font-medium">
                  Needs verification ({unverifiedCount})
                </h3>
                <ul className="divide-y">
                  {state.unverified_documents.map((document) => (
                    <li key={document.id}>
                      <Link
                        to="/documents/$documentId"
                        params={{ documentId: document.id }}
                        className="flex items-center gap-2 rounded-md py-2 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <DocumentVerificationBadge verification={null} />
                        <span className="min-w-0 truncate">
                          {document.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/"
                  search={{ status: "unverified" }}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  View all unverified documents
                </Link>
              </section>
            )}
            {!needsAttention && (
              <p className="workspace-description py-4">
                You are all caught up.
              </p>
            )}
          </div>
          <section className="shrink-0 border-t pt-4">
            <div className="flex items-center gap-2">
              <span
                className={`size-1.5 rounded-full ${state.worker_online ? "bg-success-foreground" : "bg-muted-foreground"}`}
              />
              <h2 className="text-xs font-medium">
                {state.worker_online
                  ? "Inbox is being watched"
                  : "Inbox is paused"}
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              New PDFs are picked up automatically. Originals are kept with
              their scan history.
            </p>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Inbox location</summary>
              <code className="mt-2 block break-all">{state.inbox_path}</code>
            </details>
          </section>
        </aside>
      </div>
    </div>
  );
}
