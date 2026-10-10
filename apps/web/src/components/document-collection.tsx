import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { DocumentTable } from "./document-table";
import { getDocumentTags } from "@/lib/catalog-icons";

const DocumentGrid = lazy(() => import("./document-grid"));

export function DocumentCollection({
  layout,
  ...props
}: ComponentProps<typeof DocumentTable> & { layout: "list" | "grid" }) {
  if (layout === "list") {
    return <DocumentTable {...props} />;
  }
  return (
    <ClientOnly
      fallback={
        <GridPlaceholder documents={props.documents} catalog={props.catalog} />
      }
    >
      <Suspense
        fallback={
          <GridPlaceholder
            documents={props.documents}
            catalog={props.catalog}
          />
        }
      >
        <DocumentGrid {...props} />
      </Suspense>
    </ClientOnly>
  );
}

function GridPlaceholder({
  documents,
  catalog,
}: Pick<ComponentProps<typeof DocumentTable>, "documents" | "catalog">) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 py-4"
      aria-label="Loading documents"
    >
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3"
        >
          <div className="h-[34px]" />
          <div className="aspect-[4/3] rounded-md bg-background" />
          <div className="h-8" />
          {document.creator_ids.length > 0 && <div className="h-10" />}
          {getDocumentTags(document, catalog).length > 0 && (
            <div className="mt-auto h-5" />
          )}
        </div>
      ))}
    </div>
  );
}
