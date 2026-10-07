import type { ComponentProps, ReactNode } from "react";
import type { components } from "@/lib/schema";
import { PdfPreview } from "./pdf-preview";
import { DocumentTags } from "./document-tags";
import { ProcessingCost } from "./processing-cost";
import { PipelineMessage } from "./pipeline-message";
import { LocalTime } from "./local-time";
import { DocumentInformation } from "./document-information";
import { DetailViewLayout } from "./detail-view-layout";
import { FileLink } from "./file-link";

export function DocumentView({
  document,
  scanName,
  text,
  catalog,
  view,
  allowActions,
  search,
  sidebar,
  editor,
}: {
  document: components["schemas"]["Document"];
  scanName: string;
  text: string;
  catalog: components["schemas"]["Catalog"];
  view: "pdf" | "text" | "summary" | "details";
  allowActions: boolean;
  search: ComponentProps<typeof DocumentTags>["search"];
  sidebar: boolean;
  editor?: ReactNode;
}) {
  return (
    <DetailViewLayout
      editor={editor}
      sidebar={
        sidebar && (
          <DocumentInformation
            document={document}
            scanName={scanName}
            catalog={catalog}
            search={search}
            allowActions={allowActions}
          />
        )
      }
    >
      {document.enrichment_status !== "complete" && (
        <PipelineMessage
          title={
            {
              pending: "Waiting for document processing",
              running: "Updating tags and summary",
              failed: "Document processing stopped",
            }[document.enrichment_status]
          }
          failed={document.enrichment_status === "failed"}
        >
          {document.enrichment_error || "Progress updates automatically."}
        </PipelineMessage>
      )}
      <div className="document-panels">
        <div
          className="document-panel"
          data-active={Boolean(editor) || view === "pdf"}
          aria-hidden={!editor && view !== "pdf"}
          inert={!editor && view !== "pdf"}
        >
          <PdfPreview
            title={document.title}
            url={`/api/documents/${document.id}/pdf`}
          />
        </div>
        <div
          className="document-panel"
          data-active={!editor && view === "text"}
          aria-hidden={Boolean(editor) || view !== "text"}
          inert={Boolean(editor) || view !== "text"}
        >
          <pre className="whitespace-pre-wrap break-words p-3 font-sans text-sm leading-relaxed">
            {text}
          </pre>
        </div>
        <div
          className="document-panel"
          data-active={!editor && view === "summary"}
          aria-hidden={Boolean(editor) || view !== "summary"}
          inert={Boolean(editor) || view !== "summary"}
        >
          <div className="flex w-full max-w-xl flex-col gap-4 p-3">
            <section className="space-y-2">
              <h2 className="workspace-title">Summary</h2>
              <p className="workspace-description">
                {document.summary || "No summary yet."}
              </p>
            </section>
            {!sidebar && (
              <DocumentTags
                key={document.id}
                document={document}
                catalog={catalog}
                allowActions={allowActions}
                search={search}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Your saved tag choices and summary corrections take priority when
              you reprocess this document.
            </p>
          </div>
        </div>
        <div
          className="document-panel"
          data-active={!editor && view === "details"}
          aria-hidden={Boolean(editor) || view !== "details"}
          inert={Boolean(editor) || view !== "details"}
        >
          {sidebar && (
            <div className="detail-information-compact border-b p-3">
              <DocumentInformation
                document={document}
                scanName={scanName}
                catalog={catalog}
                search={search}
                allowActions={allowActions}
              />
            </div>
          )}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 break-all p-3 text-xs leading-relaxed">
            <dt>Source scan</dt>
            <dd>
              <FileLink
                to="/scans/$scanId"
                params={{ scanId: document.scan_id }}
                search={{ preview: true }}
                filename={scanName}
              />
            </dd>
            <dt>Source pages</dt>
            <dd>{document.source_pages.join(", ")}</dd>
            <dt>Processing run</dt>
            <dd>{document.processing_run}</dd>
            <dt>Date source</dt>
            <dd>
              {document.date_source === "document"
                ? "Printed on document"
                : "Scan date fallback"}
            </dd>
            {!sidebar && (
              <>
                <dt>Scanned at</dt>
                <dd>
                  <LocalTime value={document.scanned_at} />
                </dd>
                <dt>Processed at</dt>
                <dd>
                  <LocalTime value={document.processed_at} />
                </dd>
              </>
            )}
            <dt>File path</dt>
            <dd>{document.final_path}</dd>
            <dt>Tagging version</dt>
            <dd>{document.enrichment_version || "Not processed"}</dd>
          </dl>
          <ProcessingCost processing={document.processing} />
        </div>
      </div>
    </DetailViewLayout>
  );
}
