import { useAccess } from "./auth/access-context";
import { canAdmin } from "@/lib/auth/access";
import { Link } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { ScanStatus } from "./collection";
import { buttonVariants } from "./ui/button";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";
import { DocumentIdentity } from "./document-identity";

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
          <section className="space-y-2 pt-4">
            <Separator className="mb-4" />
            <h3 className="text-xs font-medium">
              Needs routing ({state.routing_total})
            </h3>
            <AttentionDocuments documents={state.routing_documents} />
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
            className="space-y-2 pt-4"
            aria-labelledby="verification-heading"
          >
            <Separator className="mb-4" />
            <h3 id="verification-heading" className="text-xs font-medium">
              Needs verification ({unverifiedCount})
            </h3>
            <AttentionDocuments documents={state.unverified_documents} />
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

function AttentionDocuments({
  documents,
}: {
  documents: components["schemas"]["Document"][];
}) {
  return (
    <ul>
      {documents.map((document, index) => (
        <li key={document.id}>
          {index > 0 && <Separator className="my-2" />}
          <div className="relative rounded-lg py-2 hover:bg-accent has-[a:focus-visible]:bg-accent/50">
            <DocumentIdentity document={document}>
              <Link
                to="/documents/$documentId"
                params={{ documentId: document.id }}
                title={document.title}
                className="document-link outline-none hover:no-underline after:absolute after:inset-0 after:rounded-lg"
              >
                {document.title}
              </Link>
            </DocumentIdentity>
          </div>
        </li>
      ))}
    </ul>
  );
}
