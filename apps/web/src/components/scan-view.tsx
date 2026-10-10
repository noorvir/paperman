import { useNavigate } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { EmptyState } from "./page";
import { LocalTime } from "./local-time";
import { PdfPreview } from "./pdf-preview";
import { DocumentCollection } from "./document-collection";
import { DocumentLayoutToggle } from "./document-layout-toggle";
import { CollectionWorkspace } from "./collection-workspace";
import { ScanCost } from "./scan-cost";
import { DetailViewLayout } from "./detail-view-layout";
import { ScanInformation } from "./scan-information";

export function ScanView({
  scan,
  documents,
  catalog,
  view,
  layout,
  onLayoutChange,
  sidebar,
}: {
  scan: components["schemas"]["ScanDetail"];
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
  view: "pdf" | "documents" | "activity" | "details";
  layout: "list" | "grid";
  onLayoutChange: (layout: "list" | "grid") => void;
  sidebar: boolean;
}) {
  const navigate = useNavigate();
  return (
    <DetailViewLayout
      sidebar={sidebar && <ScanInformation scan={scan} documents={documents} />}
    >
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
              onNavigate={(documentId) =>
                navigate({
                  to: "/documents/$documentId",
                  params: { documentId },
                  resetScroll: false,
                })
              }
            >
              <div className="flex items-center justify-between gap-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {documents.length} filed documents
                </p>
                <DocumentLayoutToggle
                  value={layout}
                  onChange={onLayoutChange}
                />
              </div>
              <div className="collection-content">
                <div className="collection-body">
                  <DocumentCollection
                    preview={false}
                    layout={layout}
                    documents={documents}
                    catalog={catalog}
                    search={{}}
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
                  <LocalTime value={event.at} /> ·{" "}
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
          <div
            className={
              sidebar
                ? "detail-information-compact border-b p-3"
                : "border-b p-3"
            }
          >
            <ScanInformation scan={scan} documents={documents} />
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 break-all p-3 text-xs leading-relaxed">
            <dt>SHA-256</dt>
            <dd>{scan.content_hash}</dd>
            <dt>Timestamp source</dt>
            <dd>{scan.timestamp_source}</dd>
          </dl>
          <ScanCost scan={scan} />
        </div>
      </div>
    </DetailViewLayout>
  );
}
