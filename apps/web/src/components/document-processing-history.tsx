import type { components } from "@/lib/schema";
import { processingLabels } from "@/lib/processing";
import { LocalTime } from "./local-time";
import { DocumentProcessingStatus } from "./document-processing-status";

export function DocumentProcessingHistory({
  document,
}: {
  document: components["schemas"]["Document"];
}) {
  const events = document.processing.length
    ? document.processing.map(({ call }) => ({
        at: call.started_at,
        message: processingLabels[call.stage],
        detail: `${call.status === "complete" ? "Completed" : "Failed"} · ${call.seconds.toFixed(1)} s`,
        failed: call.status === "failed",
      }))
    : document.history
        .filter((event) =>
          ["analyze", "ocr", "file", "tag"].includes(event.stage),
        )
        .map((event) => ({ ...event, detail: "", failed: false }));
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <section
      className="space-y-4 border-b p-3 text-xs"
      aria-label="Processing history"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="workspace-title">Processing</h2>
        <DocumentProcessingStatus document={document} />
      </div>
      <ol className="ml-1 border-l border-border">
        {[
          {
            at: document.scanned_at,
            message: "Scan received",
            detail: "",
            failed: false,
          },
          ...events,
        ].map((event, index) => (
          <li
            key={`${event.at}-${index}`}
            className="relative pb-4 pl-4 last:pb-0"
          >
            <span
              aria-hidden="true"
              className={`absolute -left-1 top-1 size-2 rounded-full ring-4 ring-background ${event.failed ? "bg-destructive" : "bg-muted-foreground"}`}
            />
            <p className="break-words leading-relaxed">{event.message}</p>
            <p className="mt-1 text-muted-foreground">
              <LocalTime value={event.at} />
              {event.detail && <> · {event.detail}</>}
            </p>
          </li>
        ))}
      </ol>
      {document.enrichment_status === "pending" && (
        <p className="text-muted-foreground">
          Waiting for the worker to start.
        </p>
      )}
      {document.enrichment_status === "running" && (
        <p className="text-muted-foreground">
          Updating creators, tags, and summary. Your document remains available.
        </p>
      )}
      {document.enrichment_status === "failed" && (
        <p role="alert" className="text-destructive">
          {document.enrichment_error ||
            "Processing failed. Use Reprocess to try again."}
        </p>
      )}
    </section>
  );
}
