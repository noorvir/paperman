import { Link } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { enrichDocument } from "@/lib/actions";
import { ActionButton, ErrorNotice, DetailLayout } from "./page";
import { PdfPreview } from "./pdf-preview";
import { DocumentTags } from "./document-tags";

export function DocumentView({
  document,
  text,
  catalog,
  view,
}: {
  document: components["schemas"]["Document"];
  text: string;
  catalog: components["schemas"]["Catalog"];
  view: "pdf" | "text" | "details";
}) {
  const views: (typeof view)[] = ["pdf", "text", "details"];
  return (
    <DetailLayout
      toolbar={
        <nav aria-label="Document view" className="view-tabs">
          {views.map((tab) => (
            <Link
              key={tab}
              from="/documents/$documentId"
              to="/documents/$documentId"
              params={{ documentId: document.id }}
              search={(previous) => ({ ...previous, view: tab })}
              replace
              resetScroll={false}
              data-active={view === tab}
              aria-current={view === tab ? "page" : undefined}
            >
              {tab === "pdf" ? "PDF" : tab === "text" ? "Text" : "Details"}
            </Link>
          ))}
        </nav>
      }
      aside={
        <>
          <ErrorNotice message={document.enrichment_error ?? ""} />
          <section className="space-y-2">
            <h2 className="workspace-title">Summary</h2>
            <p className="workspace-description">
              {document.summary || "No summary yet."}
            </p>
          </section>
          <DocumentTags
            key={document.id}
            document={document}
            catalog={catalog}
          />
          <ActionButton
            disabled={
              document.enrichment_status === "running" ||
              document.enrichment_status === "pending"
            }
            action={() => enrichDocument({ data: document.id })}
          >
            {document.enrichment_status === "failed"
              ? "Retry tagging"
              : "Run tagging again"}
          </ActionButton>
          <p className="text-xs text-muted-foreground">
            Tagging: {document.enrichment_status}. Your saved tag choices take
            priority.
          </p>
        </>
      }
    >
      <div className="document-panels">
        <div
          className="document-panel"
          data-active={view === "pdf"}
          aria-hidden={view !== "pdf"}
          inert={view !== "pdf"}
        >
          <PdfPreview
            title={document.title}
            url={`/api/documents/${document.id}/pdf`}
          />
        </div>
        <div
          className="document-panel"
          data-active={view === "text"}
          aria-hidden={view !== "text"}
          inert={view !== "text"}
        >
          <pre className="whitespace-pre-wrap break-words p-3 font-sans text-sm leading-relaxed">
            {text}
          </pre>
        </div>
        <div
          className="document-panel"
          data-active={view === "details"}
          aria-hidden={view !== "details"}
          inert={view !== "details"}
        >
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 break-all p-3 text-xs leading-relaxed">
            <dt>Source scan</dt>
            <dd>
              <Link
                to="/scans/$scanId"
                params={{ scanId: document.scan_id }}
                className="underline"
              >
                Open original batch
              </Link>
            </dd>
            <dt>Source pages</dt>
            <dd>{document.source_pages.join(", ")}</dd>
            <dt>Date source</dt>
            <dd>
              {document.date_source === "document"
                ? "Printed on document"
                : "Scan date fallback"}
            </dd>
            <dt>Scanned</dt>
            <dd>{document.scanned_at}</dd>
            <dt>File path</dt>
            <dd>{document.final_path}</dd>
            <dt>Tagging version</dt>
            <dd>{document.enrichment_version || "Not processed"}</dd>
          </dl>
        </div>
      </div>
    </DetailLayout>
  );
}
