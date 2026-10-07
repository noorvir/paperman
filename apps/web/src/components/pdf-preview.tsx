import {
  lazy,
  Suspense,
  useCallback,
  useState,
  type ComponentProps,
} from "react";
import { CatchBoundary, ClientOnly } from "@tanstack/react-router";
import { PdfLoading, PdfError } from "./pdf-preview-state";

const PdfViewer = lazy(() => import("./pdf-viewer"));

export function PdfPreview({
  url,
  title,
  rotations,
  onRotatePage,
}: Omit<ComponentProps<typeof PdfViewer>, "onReady">) {
  const [display, setDisplay] = useState({ url, ready: false });
  if (display.url !== url) {
    setDisplay({ url, ready: false });
  }
  const ready = display.url === url && display.ready;
  const markReady = useCallback(() => {
    setDisplay((current) => {
      if (current.url !== url || current.ready) {
        return current;
      }
      return { url, ready: true };
    });
  }, [url]);
  return (
    <div className="pdf-preview relative" aria-busy={!ready}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex bg-background">
          <PdfLoading />
        </div>
      )}
      <div
        className="flex min-h-0 flex-1 flex-col"
        aria-hidden={!ready}
        inert={!ready}
      >
        <CatchBoundary
          getResetKey={() => url}
          errorComponent={() => <PdfError url={url} onReady={markReady} />}
        >
          <ClientOnly>
            <Suspense fallback={null}>
              <PdfViewer
                url={url}
                title={title}
                onReady={markReady}
                rotations={rotations}
                onRotatePage={onRotatePage}
              />
            </Suspense>
          </ClientOnly>
        </CatchBoundary>
      </div>
    </div>
  );
}
