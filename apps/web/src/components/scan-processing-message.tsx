import { Link } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { retryScan } from "@/lib/actions";
import { PipelineMessage } from "./pipeline-message";
import { ActionButton } from "./page";
import { buttonVariants } from "./ui/button";

export function ScanProcessingMessage({
  scan,
  documents,
}: {
  scan: components["schemas"]["ScanDetail"];
  documents: components["schemas"]["Document"][];
}) {
  if (scan.status === "failed") {
    return (
      <PipelineMessage
        title="Processing stopped"
        failed
        action={
          <ActionButton action={() => retryScan({ data: scan.id })}>
            Retry failed stage
          </ActionButton>
        }
      >
        {scan.history.at(-1)?.message}
      </PipelineMessage>
    );
  }
  if (scan.status === "review") {
    return (
      <PipelineMessage
        title="Ready for review"
        action={
          <Link
            to="/scans/$scanId/review"
            params={{ scanId: scan.id }}
            className={buttonVariants()}
          >
            Review documents
          </Link>
        }
      >
        Check the document groups and owners before filing.
      </PipelineMessage>
    );
  }
  if (scan.status === "queued" || scan.status === "running") {
    let title = "Waiting for the worker";
    if (scan.status === "running") {
      title = {
        ocr: "Creating searchable text",
        analyze: "Splitting pages and identifying documents",
        file: "Filing documents",
        done: "Finishing scan",
      }[scan.phase];
    }
    return (
      <PipelineMessage title={title}>
        Progress updates automatically.
      </PipelineMessage>
    );
  }
  const failed = documents.filter(
    (document) => document.enrichment_status === "failed",
  );
  const firstFailure = failed[0];
  if (firstFailure) {
    return (
      <PipelineMessage
        title={`Tagging failed for ${failed.length} ${failed.length === 1 ? "document" : "documents"}`}
        failed
        action={
          <Link
            to="/documents/$documentId"
            params={{ documentId: firstFailure.id }}
            search={{ view: "summary" }}
            className={buttonVariants({ variant: "outline" })}
          >
            View and retry
          </Link>
        }
      >
        Filed PDFs are saved. Open the document to retry tagging.
      </PipelineMessage>
    );
  }
  const pending = documents.filter(
    (document) => document.enrichment_status !== "complete",
  ).length;
  if (pending > 0) {
    const running = documents.some(
      (document) => document.enrichment_status === "running",
    );
    return (
      <PipelineMessage
        title={
          running
            ? "Adding tags and summaries"
            : "Waiting for tags and summaries"
        }
      >
        {pending} {pending === 1 ? "document" : "documents"} remaining.
      </PipelineMessage>
    );
  }
  return null;
}
