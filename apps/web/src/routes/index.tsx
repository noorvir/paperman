import { useLiveData } from "@/hooks/use-live-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload04Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
  getDashboard,
  getCatalog,
  getDocuments,
  getScans,
  documentSearch,
  scanSearch,
} from "@/lib/queries";
import { PageHeader, PageLoading, formatDate } from "@/components/page";
import { DocumentMark } from "@/components/document-mark";
import { ScanStatus } from "@/components/collection";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [state, documents, review, failed, catalog] = await Promise.all([
      getDashboard(),
      getDocuments({ data: documentSearch.parse({}) }),
      getScans({ data: scanSearch.parse({ status: "review" }) }),
      getScans({ data: scanSearch.parse({ status: "failed" }) }),
      getCatalog(),
    ]);
    return {
      state,
      catalog,
      documents,
      attention: [...failed.items, ...review.items].slice(0, 5),
    };
  },
  component: Overview,
  pendingComponent: () => (
    <div className="workspace-page max-w-6xl">
      <PageLoading />
    </div>
  ),
});
function Overview() {
  useLiveData();
  const { state, documents, attention, catalog } = Route.useLoaderData();
  return (
    <div className="workspace-page max-w-6xl">
      <PageHeader
        title="Overview"
        description="A clear view of your paperwork."
      >
        <Link to="/scans/upload" className={buttonVariants()}>
          <HugeiconsIcon icon={Upload04Icon} />
          Upload scan
        </Link>
      </PageHeader>
      <dl className="grid shrink-0 grid-cols-2 gap-y-6 border-y py-5 sm:grid-cols-4 sm:divide-x">
        <div className="sm:pr-6">
          <dt className="text-xs text-muted-foreground">Filed documents</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">
            <Link to="/documents" search={{}}>
              {state.documents}
            </Link>
          </dd>
        </div>
        <div className="sm:px-6">
          <dt className="text-xs text-muted-foreground">Processing</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">
            <Link to="/scans" search={{ status: "queued" }}>
              {state.pending}
            </Link>
          </dd>
        </div>
        <div className="sm:px-6">
          <dt className="text-xs text-muted-foreground">Needs review</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">
            <Link to="/scans" search={{ status: "review" }}>
              {state.review}
            </Link>
          </dd>
        </div>
        <div className="sm:pl-6">
          <dt className="text-xs text-muted-foreground">Failed scans</dt>
          <dd
            className={`mt-2 text-2xl font-semibold tabular-nums ${state.failed ? "text-destructive" : ""}`}
          >
            <Link to="/scans" search={{ status: "failed" }}>
              {state.failed}
            </Link>
          </dd>
        </div>
      </dl>
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
            Install Tesseract on the worker host before processing scans.
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
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="workspace-title">Recent documents</h2>
            <Link
              to="/documents"
              search={{}}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Link>
          </div>
          <div className="divide-y">
            {documents.items.slice(0, 8).map((doc) => (
              <Link
                key={doc.id}
                to="/documents/$documentId"
                params={{ documentId: doc.id }}
                search={{ preview: true }}
                className="flex items-center gap-3 py-3 hover:bg-muted/40"
              >
                <DocumentMark document={doc} catalog={catalog} />
                <div className="min-w-0 flex-1">
                  <p className="document-link">{doc.title}</p>
                  <p className="document-caption">{doc.summary}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(doc.document_date)}
                </span>
              </Link>
            ))}
          </div>
          {documents.total === 0 && (
            <p className="workspace-description py-8">
              Your filed documents will appear here.
            </p>
          )}
        </section>
        <aside className="min-w-0">
          <h2 className="workspace-title mb-3">Needs attention</h2>
          <div className="divide-y">
            {attention.map((scan) => (
              <Link
                key={scan.id}
                to="/scans/$scanId"
                params={{ scanId: scan.id }}
                search={{ preview: true }}
                className="flex flex-col items-start gap-2 py-4 hover:bg-muted/40"
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
                  {scan.status === "review" ? "Review scan" : "View and retry"}{" "}
                  →
                </span>
              </Link>
            ))}
          </div>
          {attention.length === 0 && (
            <p className="workspace-description py-4">
              You are all caught up. No scans need attention.
            </p>
          )}
          <section className="mt-6 border-t pt-5">
            <div className="flex items-center gap-2">
              <span
                className={`size-1.5 rounded-full ${state.worker_online ? "bg-emerald-500" : "bg-muted-foreground"}`}
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
