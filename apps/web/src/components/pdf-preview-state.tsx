import { Skeleton } from "./ui/skeleton";
import { useEffect } from "react";
import { buttonVariants } from "./ui/button";
import { cn } from "cn";

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
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background p-6 text-xs"
      role="alert"
    >
      <p>Preview could not load.</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Open the PDF
      </a>
    </div>
  );
}
