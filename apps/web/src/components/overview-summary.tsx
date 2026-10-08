import type { components } from "@/lib/schema";
import { Button } from "./ui/button";
import { statusTone } from "./ui/status-tone";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { PipelineProgress } from "./ui/pipeline-progress";

export function OverviewSummary({
  counts,
  status,
  onSelect,
}: {
  counts: components["schemas"]["Dashboard"]["counts"];
  status?: Status;
  onSelect: (status: Status) => void;
}) {
  return (
    <PipelineProgress
      label="Document status"
      spacing="wide"
      steps={statuses
        .filter((item) => item.id !== "unverified")
        .map((item) => ({
          id: item.id,
          label: item.label,
          status: item.id === "unverified" ? "review" : item.id,
          count: counts[item.id] ?? 0,
          detail: "",
          badge:
            item.id === "complete" && (counts.unverified ?? 0) > 0 ? (
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="attention" size="icon" />}
                  className={`absolute -right-1 -top-1 size-5 rounded-full border text-xs font-semibold aria-pressed:ring-2 aria-pressed:ring-current/25 ${statusTone({ tone: "attention" })}`}
                  aria-label={`Needs verification: ${counts.unverified}`}
                  aria-pressed={status === "unverified"}
                  aria-controls="overview-work"
                  onClick={() => onSelect("unverified")}
                >
                  <span aria-hidden="true">!</span>
                </TooltipTrigger>
                <TooltipContent>
                  {counts.unverified} documents need verification
                </TooltipContent>
              </Tooltip>
            ) : undefined,
        }))}
      selection={{
        value: status,
        onChange: onSelect,
        controls: "overview-work",
      }}
    />
  );
}

type Status = components["schemas"]["PipelinePage"]["status"];

export const statuses: { id: Status; label: string }[] = [
  { id: "queued", label: "Unprocessed" },
  { id: "running", label: "Processing" },
  { id: "review", label: "Scan review" },
  { id: "unverified", label: "Needs verification" },
  { id: "complete", label: "Processed" },
  { id: "failed", label: "Failed" },
];
