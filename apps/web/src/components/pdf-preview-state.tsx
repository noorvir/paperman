import { Skeleton } from "./ui/skeleton";
import { PdfToolbarLayout } from "./pdf-toolbar-layout";
import { useEffect } from "react";
import { buttonVariants } from "./ui/button";
import { cn } from "cn";

export function PdfLoading() {
  return (
    <div
      className="pdf-viewer @container bg-muted/60 [&_[data-slot=skeleton]]:bg-foreground/5"
      aria-label="Loading PDF"
      aria-busy="true"
    >
      <PdfToolbarLayout
        pages={
          <>
            <Skeleton className="size-7 animate-none" />
            <Skeleton className="h-7 w-9 animate-none" />
            <Skeleton className="h-3 w-7 animate-none" />
            <Skeleton className="size-7 animate-none" />
          </>
        }
        zoom={
          <>
            <Skeleton className="hidden size-7 animate-none @min-[28rem]:block" />
            <Skeleton className="h-7 w-20 animate-none @min-[24rem]:w-25" />
            <Skeleton className="hidden size-7 animate-none @min-[28rem]:block" />
          </>
        }
        actions={
          <>
            <Skeleton className="size-7 animate-none" />
            <Skeleton className="size-7 animate-none" />
            <Skeleton className="size-7 animate-none" />
          </>
        }
      />
      <div className="min-h-0 flex-1" />
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
