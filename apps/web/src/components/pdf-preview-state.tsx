import { Skeleton } from "./ui/skeleton";
import { useEffect } from "react";

export function PdfLoading() {
  return (
    <div className="pdf-viewer" aria-label="Loading PDF" aria-busy="true">
      <div className="pdf-toolbar">Loading PDF</div>
      <div className="pdf-pages">
        <Skeleton className="mx-auto aspect-[1/1.414] h-full max-w-full animate-none bg-background" />
      </div>
    </div>
  );
}

export function PdfError({
  url,
  onReady,
}: {
  url: string;
  onReady: () => void;
}) {
  useEffect(onReady, [onReady]);
  return (
    <p className="absolute inset-0 z-20 bg-background p-6 text-sm" role="alert">
      Preview could not load.{" "}
      <a href={url} target="_blank" rel="noreferrer" className="underline">
        Open the PDF
      </a>
    </p>
  );
}
