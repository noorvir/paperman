import { DocumentAccess } from "./document-access";
import { useAccess } from "./auth/access-context";
import { useState, type ComponentProps, type ReactNode } from "react";
import { linkOptions } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { DocumentContextControls } from "./document-context-controls";
import { DocumentPdf } from "./document-pdf";
import { PdfPreview } from "./pdf-preview";
import { DocumentTags } from "./document-tags";
import { ProcessingCost } from "./processing-cost";
import { PipelineMessage } from "./pipeline-message";
import { LocalTime } from "./local-time";
import { DocumentInformation } from "./document-information";
import { DetailViewLayout } from "./detail-view-layout";
import { FileLink } from "./file-link";
import { ScanInformation } from "./scan-information";
import { DocumentSource } from "./document-source";
import type { documentView } from "@/lib/queries";
import type { z } from "zod";

export function DocumentView({
  document,
  source,
  sourceReference,
  canManageAccess,
  canEditPages,
  text,
  catalog,
  view,
  allowActions,
  search,
  preview,
  editor,
  rotations,
  pdfRevision,
  onRotatePage,
  pageSelection,
}: {
  document: components["schemas"]["Document"];
  source: ComponentProps<typeof ScanInformation> | null;
  sourceReference: components["schemas"]["SourceReference"];
  canManageAccess: boolean;
  canEditPages: boolean;
  text: string;
  catalog: components["schemas"]["Catalog"];
  view: z.output<typeof documentView>;
  allowActions: boolean;
  search: ComponentProps<typeof DocumentTags>["search"];
  preview: boolean;
  editor?: ReactNode;
  rotations?: number[];
  pdfRevision: number;
  onRotatePage?: (page: number) => void;
  pageSelection?: ComponentProps<typeof PdfPreview>["pageSelection"];
}) {
  const access = useAccess();
  const sidebar = !preview;
  const [showContext, setShowContext] = useState(false);
  const contextControls = source && (
    <DocumentContextControls checked={showContext} onChange={setShowContext} />
  );
  const [openedSource, setOpenedSource] = useState(view === "source");
  if (view === "source" && !openedSource) {
    setOpenedSource(true);
  }
  const sourceDestination = preview
    ? linkOptions({
        to: "/documents",
        search: { ...search, preview: document.id, view: "source" },
      })
    : linkOptions({
        to: "/documents/$documentId",
        params: { documentId: document.id },
        search: { ...search, view: "source" },
      });
  const sourceLink = source ? (
    <FileLink
      {...sourceDestination}
      replace
      resetScroll={false}
      filename={source.scan.original_name}
    />
  ) : (
    <span className="text-muted-foreground">
      {sourceReference.inbox === "shared" ? "Shared inbox" : "Personal inbox"} ·
      Source access restricted
    </span>
  );
  return (
    <DetailViewLayout
      editor={editor}
      sidebar={
        sidebar &&
        (view === "source" && source ? (
          <ScanInformation {...source} />
        ) : (
          <DocumentInformation
            viewControls={view === "pdf" && contextControls}
            accessControls={
              canManageAccess &&
              access.state === "authenticated" &&
              allowActions && <DocumentAccess document={document} />
            }
            document={document}
            sourceLink={sourceLink}
            catalog={catalog}
            search={search}
            allowActions={allowActions}
          />
        ))
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
          {editor && source && canEditPages ? (
            <PdfPreview
              url={`/api/scans/${source.scan.id}/pdf?variant=searchable`}
              title={`Select pages from ${source.scan.original_name}`}
              initialPage={document.source_pages[0]}
              rotations={rotations}
              onRotatePage={onRotatePage}
              pageSelection={pageSelection}
            />
          ) : (
            <DocumentPdf
              title={document.title}
              rotations={rotations}
              onRotatePage={onRotatePage}
              showContext={!editor && source !== null && showContext}
              source={
                source
                  ? {
                      url: `/api/scans/${source.scan.id}/pdf`,
                      title: `Source scan: ${source.scan.original_name}`,
                      pages: document.source_pages,
                    }
                  : null
              }
              url={`/api/documents/${document.id}/pdf?pdf_revision=${pdfRevision}`}
            />
          )}
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
          <div
            className={
              sidebar
                ? "detail-information-compact border-b p-3"
                : "border-b p-3"
            }
          >
            <DocumentInformation
              document={document}
              accessControls={
                canManageAccess &&
                access.state === "authenticated" &&
                allowActions && <DocumentAccess document={document} />
              }
              sourceLink={sourceLink}
              catalog={catalog}
              search={search}
              allowActions={allowActions}
            />
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 break-all p-3 text-xs leading-relaxed">
            {sourceLink && (
              <>
                <dt>Source scan</dt>
                <dd>{sourceLink}</dd>
              </>
            )}
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
        <div
          className="document-panel"
          data-active={!editor && view === "source"}
          aria-hidden={Boolean(editor) || view !== "source"}
          inert={Boolean(editor) || view !== "source"}
          aria-label="Source scan"
        >
          {openedSource && !source && (
            <div className="space-y-3 p-4">
              <h2 className="workspace-title">Source access restricted</h2>
              <p className="workspace-description">
                This document came from{" "}
                {sourceReference.inbox === "shared"
                  ? "the shared inbox"
                  : "another personal inbox"}
                . You can read this document, but you do not have access to the
                full source scan.
              </p>
              <p className="text-xs text-muted-foreground">
                Source pages: {document.source_pages.join(", ")}
              </p>
            </div>
          )}
          {openedSource && source && (
            <DocumentSource
              source={source}
              pages={document.source_pages}
              sidebar={sidebar}
            />
          )}
        </div>
      </div>
    </DetailViewLayout>
  );
}
