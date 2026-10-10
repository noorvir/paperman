import type { components } from "@/lib/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function DocumentProcessingStatus({
  document,
}: {
  document: components["schemas"]["Document"];
}) {
  const status = document.enrichment_status;
  if (status === "complete") return null;
  const label = {
    pending: "Waiting",
    running: "Processing",
    failed: "Failed",
    complete: "",
  }[status];
  const description = {
    pending: "Waiting for document processing",
    running: "Updating creators, tags, and summary",
    failed: "Document processing stopped",
    complete: "Document processing complete",
  }[status];
  const dotColor = {
    pending: "bg-muted-foreground",
    running: "bg-attention-indicator",
    failed: "bg-destructive",
    complete: "bg-success-foreground",
  }[status];

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        role="status"
        aria-atomic="true"
        className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm text-xs font-normal text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={`size-1.5 shrink-0 rounded-full ${dotColor}`}
        />
        {label}
      </TooltipTrigger>
      <TooltipContent>
        <span>
          {description}
          {document.enrichment_error && (
            <span className="mt-1 block">{document.enrichment_error}</span>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
