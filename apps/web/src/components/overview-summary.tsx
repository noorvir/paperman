import type { components } from "@/lib/schema";
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
      steps={statuses.map((item) => ({
        id: item.id,
        label: item.label,
        status: item.id === "unverified" ? "review" : item.id,
        count: counts[item.id] ?? 0,
        detail: "",
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
