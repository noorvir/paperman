import { Link } from "@tanstack/react-router";
import { useContext, useEffect, useState, type ComponentProps } from "react";
import {
  CollectionLink,
  CollectionSelectionContext,
} from "./collection-workspace";
import { DocumentIdentity } from "./document-identity";
import { DocumentTagPopover } from "./document-tag-popover";
import type { DocumentTable } from "./document-table";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { DocumentCreators } from "./document-creators";
import { DocumentOwners } from "./document-owners";
import { DocumentVerificationBadge } from "./document-verification-badge";
import { getDocumentTags } from "@/lib/catalog-icons";

export default function DocumentGrid({
  documents,
  catalog,
  search,
  selectedId,
  preview = true,
}: ComponentProps<typeof DocumentTable>) {
  const activeId = useContext(CollectionSelectionContext);
  const { engine, error } = usePdfiumEngine({
    wasmUrl: new URL(wasmUrl, window.location.href).href,
    fontFallback: null,
  });
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 py-4">
      {documents.map((doc) => {
        return (
          <div
            key={doc.id}
            data-collection-row
            data-state={activeId === doc.id ? "selected" : undefined}
            className="group relative flex min-w-0 flex-col gap-3 rounded-xl bg-muted/60 p-3 hover:bg-accent/30 data-[state=selected]:bg-accent/50 has-[[data-collection-link]:focus-visible]:bg-accent/50"
          >
            <div className="flex min-w-0 items-start gap-2">
              <DocumentIdentity document={doc} search={search}>
                <CollectionLink
                  itemId={doc.id}
                  selected={selectedId === doc.id}
                  preview={preview}
                  {...(preview
                    ? {
                        to: "/documents",
                        search: { ...search, preview: doc.id },
                      }
                    : {
                        to: "/documents/$documentId",
                        params: { documentId: doc.id },
                        search: { ...search },
                      })}
                  resetScroll={false}
                  aria-label={`${preview ? "Preview" : "Open"} ${doc.title}`}
                  title={doc.title}
                  className="after:absolute after:inset-0 after:rounded-xl"
                >
                  {doc.title}
                </CollectionLink>
              </DocumentIdentity>
              <span className="relative z-10 inline-flex shrink-0">
                <DocumentVerificationBadge
                  verification={doc.verification}
                  render={
                    <Link
                      to="/documents/$documentId"
                      params={{ documentId: doc.id }}
                      search={{ ...search }}
                    />
                  }
                />
              </span>
            </div>
            <div className="pointer-events-none">
              <DocumentThumbnail
                engine={engine}
                failed={Boolean(error)}
                documentId={doc.id}
                title={doc.title}
              />
            </div>
            <div className="relative z-10 min-w-0 text-xs">
              <DocumentOwners
                compact
                maxVisible={2}
                ownerIds={doc.owner_ids}
                owners={catalog.owners}
                search={search}
              />
            </div>
            {doc.creator_ids.length > 0 && (
              <div className="relative z-10 min-w-0 text-xs">
                <span className="text-muted-foreground">Created by</span>
                <DocumentCreators
                  compact
                  document={doc}
                  catalog={catalog}
                  search={search}
                />
              </div>
            )}
            {getDocumentTags(doc, catalog).length > 0 && (
              <div className="relative z-10 mt-auto min-w-0">
                <DocumentTagPopover
                  compact
                  document={doc}
                  catalog={catalog}
                  search={search}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocumentThumbnail({
  engine,
  failed,
  documentId,
  title,
}: {
  engine: ReturnType<typeof usePdfiumEngine>["engine"];
  failed: boolean;
  documentId: string;
  title: string;
}) {
  const [preview, setPreview] = useState<{
    image: string;
    size: number;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!engine) {
      return;
    }
    const controller = new AbortController();
    let image = "";
    async function render() {
      if (!engine) {
        return;
      }
      const response = await fetch(`/api/documents/${documentId}/pdf`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("PDF unavailable");
      }
      const content = await response.arrayBuffer();
      if (controller.signal.aborted) {
        return;
      }
      const doc = await engine
        .openDocumentBuffer({ id: `thumbnail-${documentId}`, content })
        .toPromise();
      try {
        const page = doc.pages[0];
        if (!page || controller.signal.aborted) {
          return;
        }
        const blob = await engine
          .renderPage(doc, page, {
            scaleFactor: 600 / page.size.width,
            withAnnotations: true,
          })
          .toPromise();
        if (controller.signal.aborted) {
          return;
        }
        image = URL.createObjectURL(blob);
        setPreview({ image, size: content.byteLength });
      } finally {
        await engine.closeDocument(doc).toPromise();
      }
    }
    void render().catch(() => {
      if (!controller.signal.aborted) {
        setError(true);
      }
    });
    return () => {
      controller.abort();
      if (image) {
        URL.revokeObjectURL(image);
      }
    };
  }, [engine, documentId]);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-background">
      {preview ? (
        <>
          <img
            src={preview.image}
            alt={`First page of ${title}`}
            className="h-full w-full object-cover object-top"
          />
          <span className="absolute bottom-2 right-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {Math.max(1, Math.round(preview.size / 1024))} KB
          </span>
        </>
      ) : (
        <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {error || failed ? (
            "Preview unavailable"
          ) : (
            <span className="sr-only">Loading first page</span>
          )}
        </span>
      )}
    </div>
  );
}
