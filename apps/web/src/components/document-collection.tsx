import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { DocumentTable } from "./document-table";

const DocumentGrid = lazy(() => import("./document-grid"));

export function DocumentCollection({
  layout,
  ...props
}: ComponentProps<typeof DocumentTable> & { layout: "list" | "grid" }) {
  if (layout === "list") {
    return <DocumentTable {...props} />;
  }
  return (
    <ClientOnly fallback={<GridPlaceholder count={props.documents.length} />}>
      <Suspense fallback={<GridPlaceholder count={props.documents.length} />}>
        <DocumentGrid {...props} />
      </Suspense>
    </ClientOnly>
  );
}

function GridPlaceholder({ count }: { count: number }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 py-4"
      aria-label="Loading documents"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl bg-muted/60 p-3">
          <div className="mb-3 h-[22px]" />
          <div className="aspect-[4/3] rounded-md bg-background" />
          <div className="mt-3 h-4" />
          <div className="mt-3 h-6" />
          <div className="mt-2 h-4" />
        </div>
      ))}
    </div>
  );
}
