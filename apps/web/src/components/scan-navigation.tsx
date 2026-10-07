import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { ScanView } from "./scan-view";
import { PipelineProgress } from "./ui/pipeline-progress";
import { ScanProcessingMessage } from "./scan-processing-message";

export function ScanNavigation({
  scan,
  documents,
  view,
}: Pick<ComponentProps<typeof ScanView>, "scan" | "documents" | "view">) {
  const views: (typeof view)[] = ["pdf", "documents", "activity", "details"];
  return (
    <div className="flex flex-col gap-2">
      <div className="shrink-0 pb-2">
        <PipelineProgress
          label="Scan processing stages"
          steps={scan.pipeline}
        />
      </div>
      <ScanProcessingMessage scan={scan} documents={documents} />
      <nav aria-label="Scan view" className="view-tabs">
        {views.map((tab) => (
          <Link
            key={tab}
            from="/scans/$scanId"
            to="/scans/$scanId"
            params={{ scanId: scan.id }}
            search={(previous) => ({ ...previous, view: tab })}
            replace
            resetScroll={false}
            data-active={view === tab}
            aria-current={view === tab ? "page" : undefined}
          >
            {
              {
                pdf: "PDF",
                documents: "Documents",
                activity: "Activity",
                details: "Details",
              }[tab]
            }
          </Link>
        ))}
      </nav>
    </div>
  );
}
