import { useMemo } from "react";
import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF } from "@embedpdf/core/react";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from "@embedpdf/plugin-document-manager/react";
import {
  Viewport,
  ViewportPluginPackage,
} from "@embedpdf/plugin-viewport/react";
import { Scroller, ScrollPluginPackage } from "@embedpdf/plugin-scroll/react";
import {
  RenderLayer,
  RenderPluginPackage,
} from "@embedpdf/plugin-render/react";
import { ZoomMode, ZoomPluginPackage } from "@embedpdf/plugin-zoom/react";
import { Rotate, RotatePluginPackage } from "@embedpdf/plugin-rotate/react";
import {
  SearchLayer,
  SearchPluginPackage,
} from "@embedpdf/plugin-search/react";
import {
  SelectionLayer,
  CopyToClipboard,
  SelectionPluginPackage,
} from "@embedpdf/plugin-selection/react";
import {
  PagePointerProvider,
  InteractionManagerPluginPackage,
} from "@embedpdf/plugin-interaction-manager/react";
import { PdfToolbar } from "./pdf-toolbar";
import { PdfError } from "./pdf-preview-state";
import { PdfPageSelection } from "./pdf-page-selection";

export default function PdfViewer({
  url,
  title,
  onReady,
  rotations,
  onRotatePage,
  initialPage,
  highlightedPages,
  pageSelection,
}: {
  url: string;
  title: string;
  onReady: () => void;
  rotations?: number[];
  onRotatePage?: (page: number) => void;
  initialPage?: number;
  highlightedPages?: number[];
  pageSelection?: {
    pages: number[];
    onToggle: (page: number) => void;
    onMove: (page: number, position: number) => void;
    disabled: boolean;
  };
}) {
  const { engine, error } = usePdfiumEngine({
    // Blob workers need an absolute URL for the bundled WebAssembly asset.
    wasmUrl: new URL(wasmUrl, window.location.href).href,
    fontFallback: null,
  });
  const includedPages = pageSelection?.pages ?? highlightedPages;
  const plugins = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [{ url }],
      }),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ScrollPluginPackage, { defaultPageGap: 16 }),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: ZoomMode.Automatic,
        minZoom: 0.25,
        maxZoom: 3,
      }),
      createPluginRegistration(RotatePluginPackage),
      createPluginRegistration(SearchPluginPackage),
    ],
    [url],
  );

  if (error) {
    return <PdfError url={url} onReady={onReady} />;
  }
  if (!engine) {
    return null;
  }

  // Mount utilities explicitly so plugin startup cannot replace the display tree.
  return (
    <EmbedPDF
      key={url}
      engine={engine}
      plugins={plugins}
      autoMountDomElements={false}
    >
      {({ activeDocumentId }) => {
        if (!activeDocumentId) {
          return null;
        }

        return (
          <DocumentContent documentId={activeDocumentId}>
            {({ isLoaded, isError }) => {
              if (isError) {
                return <PdfError url={url} onReady={onReady} />;
              }
              if (!isLoaded) {
                return null;
              }

              return (
                <section
                  aria-label={title}
                  className="pdf-viewer @container"
                  onLoadCapture={(event) => {
                    if (event.target instanceof HTMLImageElement) {
                      onReady();
                    }
                  }}
                >
                  <CopyToClipboard />
                  <PdfToolbar
                    documentId={activeDocumentId}
                    url={url}
                    editing={Boolean(rotations)}
                    onRotatePage={onRotatePage}
                    initialPage={initialPage}
                    rotatablePages={pageSelection?.pages}
                  />
                  <Viewport
                    documentId={activeDocumentId}
                    className="min-h-0 flex-1"
                    role="region"
                    aria-label="PDF pages"
                    tabIndex={0}
                  >
                    <Scroller
                      documentId={activeDocumentId}
                      renderPage={({ width, height, pageIndex }) => (
                        <div
                          className="relative bg-white shadow-sm"
                          data-page-number={pageIndex + 1}
                          data-included={includedPages?.includes(pageIndex + 1)}
                          style={{ width, height }}
                        >
                          <div
                            className="data-[included=false]:opacity-25"
                            data-included={includedPages?.includes(
                              pageIndex + 1,
                            )}
                            style={{
                              width,
                              height,
                              transform: `rotate(${rotations?.[pageIndex] ?? 0}deg) scale(${(rotations?.[pageIndex] ?? 0) % 180 ? Math.min(width / height, height / width) : 1})`,
                            }}
                          >
                            <Rotate
                              documentId={activeDocumentId}
                              pageIndex={pageIndex}
                            >
                              <PagePointerProvider
                                documentId={activeDocumentId}
                                pageIndex={pageIndex}
                                className="select-none"
                              >
                                <RenderLayer
                                  documentId={activeDocumentId}
                                  pageIndex={pageIndex}
                                  aria-label={`Page ${pageIndex + 1}`}
                                  draggable={false}
                                  className="pointer-events-none"
                                />
                                <SearchLayer
                                  documentId={activeDocumentId}
                                  pageIndex={pageIndex}
                                />
                                <SelectionLayer
                                  documentId={activeDocumentId}
                                  pageIndex={pageIndex}
                                  background="Highlight"
                                />
                              </PagePointerProvider>
                            </Rotate>
                          </div>
                          {pageSelection && (
                            <PdfPageSelection
                              page={pageIndex + 1}
                              position={
                                pageSelection.pages.indexOf(pageIndex + 1) + 1
                              }
                              count={pageSelection.pages.length}
                              disabled={pageSelection.disabled}
                              onToggle={pageSelection.onToggle}
                              onMove={pageSelection.onMove}
                            />
                          )}
                        </div>
                      )}
                    />
                  </Viewport>
                </section>
              );
            }}
          </DocumentContent>
        );
      }}
    </EmbedPDF>
  );
}
