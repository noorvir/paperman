import { useAccess } from "./auth/access-context";
import { canAdmin } from "@/lib/auth/access";
import { Link } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { ScanStatus } from "./collection";
import { buttonVariants } from "./ui/button";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { DocumentVerificationBadge } from "./document-verification-badge";

export function OverviewAttention({
  state,
  attention,
  onViewAll,
}: {
  state: components["schemas"]["Dashboard"];
  attention: components["schemas"]["Scan"][];
  onViewAll: () => void;
}) {
  const admin = canAdmin(useAccess());
  const unverifiedCount = state.counts.unverified ?? 0;
  const needsAttention =
    attention.length > 0 ||
    state.routing_total > 0 ||
    unverifiedCount > 0 ||
    (admin &&
      (!state.worker_online ||
        state.worker?.status === "error" ||
        !state.model_configured ||
        !state.ocr_available)) ||
    state.enrichment_failed > 0;
  return (
    <aside
      aria-labelledby="attention-heading"
      className="flex h-full min-h-0 min-w-0 flex-col"
    >
      <h2
        id="attention-heading"
        className="workspace-title mb-3 flex h-7 shrink-0 items-center"
      >
        Needs attention
      </h2>
      <div className="min-h-0 flex-1">
        <div className="space-y-3">
          {admin && !state.worker_online && (
            <Alert variant="destructive">
              <AlertTitle>Worker is offline</AlertTitle>
              <AlertDescription>
                New scans will wait in the inbox until the worker starts.
              </AlertDescription>
            </Alert>
          )}
          {admin && state.worker?.status === "error" && (
            <Alert variant="destructive">
              <AlertTitle>Worker needs attention</AlertTitle>
              <AlertDescription>{state.worker.message}</AlertDescription>
            </Alert>
          )}
          {admin && !state.model_configured && (
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
          {admin && !state.ocr_available && (
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
                {scan.status === "review" ? "Review scan" : "View and retry"} →
              </span>
            </Link>
          ))}
        </div>
        {state.routing_total > 0 && (
          <section className="space-y-2 border-t py-4">
            <h3 className="text-xs font-medium">
              Needs delivery ({state.routing_total})
            </h3>
            <ul className="divide-y">
              {state.routing_documents.map((document) => (
                <li key={document.id}>
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: document.id }}
                    className="block truncate rounded py-2 text-xs hover:bg-accent"
                  >
                    {document.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/documents"
              search={{ delivery: "review", inbox: "shared" }}
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "w-full",
              })}
            >
              View all
            </Link>
          </section>
        )}
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
                    <span className="min-w-0 truncate">{document.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/"
              onClick={onViewAll}
              search={{ status: "unverified" }}
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "w-full",
              })}
            >
              View all
            </Link>
          </section>
        )}
        {!needsAttention && (
          <p className="workspace-description py-4">You are all caught up.</p>
        )}
      </div>
    </aside>
  );
}
