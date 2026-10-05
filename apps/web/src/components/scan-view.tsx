import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { components } from "@/lib/schema";
import { documentSearch } from "@/lib/queries";
import { EmptyState, formatDate } from "./page";
import { PdfPreview } from "./pdf-preview";
import { DocumentCollection } from "./document-collection";
import { DocumentLayoutToggle } from "./document-layout-toggle";
import { CollectionWorkspace } from "./collection-workspace";
import { PipelineProgress } from "./ui/pipeline-progress";
import { ScanProcessingMessage } from "./scan-processing-message";

export function ScanView({
  scan,
  documents,
  catalog,
  view,
}: {
  scan: components["schemas"]["ScanDetail"];
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
  view: "pdf" | "documents" | "activity" | "details";
}) {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const views: (typeof view)[] = ["pdf", "documents", "activity", "details"];
  return (
    <section className="detail-primary flex-1">
      <div className="shrink-0 border-b pb-2">
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
      <div className="document-panels">
        <div
          className="document-panel"
          data-active={view === "pdf"}
          aria-hidden={view !== "pdf"}
          inert={view !== "pdf"}
        >
          <PdfPreview title="Original scan" url={`/api/scans/${scan.id}/pdf`} />
        </div>
        <div
          className="document-panel"
          data-active={view === "documents"}
          aria-hidden={view !== "documents"}
          inert={view !== "documents"}
        >
          {documents.length === 0 ? (
            <EmptyState
              title="No filed documents"
              description="Documents appear here after this scan has been approved and filed."
            />
          ) : (
            <CollectionWorkspace
              full={false}
              items={documents}
              selectedId={undefined}
              onNavigate={(documentId, preview) =>
                navigate({
                  to: "/documents/$documentId",
                  params: { documentId },
                  search: { preview, layout },
                  resetScroll: false,
                })
              }
            >
              <div className="flex items-center justify-between gap-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {documents.length} filed documents
                </p>
                <DocumentLayoutToggle value={layout} onChange={setLayout} />
              </div>
              <div className="collection-content">
                <div className="collection-body">
                  <DocumentCollection
                    layout={layout}
                    documents={documents}
                    catalog={catalog}
                    search={documentSearch.parse({ layout })}
                    selectedId={undefined}
                  />
                </div>
              </div>
            </CollectionWorkspace>
          )}
        </div>
        <div
          className="document-panel"
          data-active={view === "activity"}
          aria-hidden={view !== "activity"}
          inert={view !== "activity"}
        >
          <ol className="space-y-5 p-3">
            {scan.history.map((event, index) => (
              <li key={`${event.at}-${index}`} className="border-l-2 pl-3">
                <p className="text-xs leading-relaxed">{event.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <time>{formatDate(event.at)}</time> ·{" "}
                  <span className="capitalize">{event.stage}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
        <div
          className="document-panel"
          data-active={view === "details"}
          aria-hidden={view !== "details"}
          inert={view !== "details"}
        >
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 break-all p-3 text-xs leading-relaxed">
            <dt>SHA-256</dt>
            <dd>{scan.content_hash}</dd>
            <dt>Timestamp source</dt>
            <dd>{scan.timestamp_source}</dd>
            <dt>Scanned</dt>
            <dd>{scan.scanned_at}</dd>
            <dt>Pages</dt>
            <dd>{scan.page_count || "Not processed"}</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
