import { useContext, useEffect, useState, type ComponentProps } from "react";
import {
  CollectionLink,
  CollectionSelectionContext,
} from "./collection-workspace";
import { FileIcon } from "./file-icon";
import { DocumentTagPopover } from "./document-tag-popover";
import type { DocumentTable } from "./document-table";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { OwnerLabel } from "./collection";
import { DocumentFilterLink } from "./document-filter-link";

export default function DocumentGrid({
  documents,
  catalog,
  search,
  selectedId,
}: ComponentProps<typeof DocumentTable>) {
  const activeId = useContext(CollectionSelectionContext);
  const { engine, error } = usePdfiumEngine({
    wasmUrl: new URL(wasmUrl, window.location.href).href,
    fontFallback: null,
  });
  const owners = new Map(catalog.owners.map((owner) => [owner.id, owner.name]));
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 py-4">
      {documents.map((doc) => {
        const filename = doc.final_path.slice(
          doc.final_path.lastIndexOf("/") + 1,
        );
        return (
          <div
            key={doc.id}
            data-state={activeId === doc.id ? "selected" : undefined}
            className="group relative min-w-0 rounded-xl bg-muted/60 p-3 hover:bg-muted data-[state=selected]:bg-muted has-[[data-collection-link]:focus-visible]:bg-muted"
          >
            <CollectionLink
              itemId={doc.id}
              selected={selectedId === doc.id}
              to="/documents/$documentId"
              params={{ documentId: doc.id }}
              search={{ ...search, preview: true, view: "pdf" }}
              resetScroll={false}
              aria-label={`Preview ${doc.title}`}
              title={doc.final_path}
              className="whitespace-normal! no-underline! after:absolute after:inset-0 after:rounded-xl"
            >
              <div className="mb-3 flex min-w-0 items-center gap-2">
                <FileIcon filename={filename} />
                <span className="truncate text-xs font-medium">{filename}</span>
              </div>
              <DocumentThumbnail
                engine={engine}
                failed={Boolean(error)}
                documentId={doc.id}
                title={doc.title}
              />
            </CollectionLink>
            <p className="mt-3 truncate text-xs font-medium" title={doc.title}>
              {doc.title}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <DocumentFilterLink
                search={search}
                filter={{ owner: doc.owner_id }}
                aria-label={`Filter by owner: ${owners.get(doc.owner_id) ?? doc.owner_id}`}
                className="-ml-1"
              >
                <OwnerLabel name={owners.get(doc.owner_id) ?? doc.owner_id} />
              </DocumentFilterLink>
              <DocumentTagPopover
                document={doc}
                catalog={catalog}
                search={search}
              />
            </div>
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {doc.final_path.slice(0, doc.final_path.lastIndexOf("/"))}/
            </p>
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
