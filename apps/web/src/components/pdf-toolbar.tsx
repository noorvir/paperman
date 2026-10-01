import { useRef } from "react";
import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Remove01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  RotateClockwiseIcon,
  Download04Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useScroll } from "@embedpdf/plugin-scroll/react";
import { useZoom, ZoomMode } from "@embedpdf/plugin-zoom/react";
import { useRotate } from "@embedpdf/plugin-rotate/react";
import { useSearch } from "@embedpdf/plugin-search/react";
import { Button, buttonVariants } from "./ui/button";
import { Input } from "./ui/input";
import { SelectField } from "./select-field";
import { PdfSearch } from "./pdf-search";

const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PdfToolbar({
  documentId,
  url,
}: {
  documentId: string;
  url: string;
}) {
  const { state: scroll, provides: navigation } = useScroll(documentId);
  const { state: zoom, provides: magnification } = useZoom(documentId);
  const { provides: rotation } = useRotate(documentId);
  const { state: search, provides: searchActions } = useSearch(documentId);
  const pageInput = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const zoomItems = [
    { value: ZoomMode.Automatic, label: "Auto" },
    { value: ZoomMode.FitPage, label: "Fit page" },
    { value: ZoomMode.FitWidth, label: "Fit width" },
    ...zoomLevels.map((value) => ({
      value: String(value),
      label: `${value * 100}%`,
    })),
  ];
  if (
    typeof zoom.zoomLevel === "number" &&
    !zoomLevels.includes(zoom.zoomLevel)
  ) {
    zoomItems.push({
      value: String(zoom.zoomLevel),
      label: `${Math.round(zoom.currentZoomLevel * 100)}%`,
    });
  }

  return (
    <>
      <div className="pdf-toolbar" role="group" aria-label="PDF controls">
        <form
          className="flex shrink-0 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const input = pageInput.current;
            if (!input) {
              return;
            }
            const value = Number(input.value);
            if (!Number.isInteger(value)) {
              input.value = String(scroll.currentPage);
              return;
            }
            const page = Math.max(1, Math.min(value, scroll.totalPages));
            input.value = String(page);
            navigation?.scrollToPage({ pageNumber: page, behavior: "instant" });
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous PDF page"
            title="Previous page"
            disabled={scroll.currentPage <= 1}
            onClick={() => navigation?.scrollToPreviousPage("instant")}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Input
            key={scroll.currentPage}
            ref={pageInput}
            aria-label="PDF page number"
            inputMode="numeric"
            pattern="[0-9]+"
            defaultValue={scroll.currentPage}
            className="w-9 bg-background px-1 text-center tabular-nums"
            onBlur={(event) => {
              event.currentTarget.value = String(scroll.currentPage);
            }}
          />
          <span className="whitespace-nowrap tabular-nums">
            / {scroll.totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next PDF page"
            title="Next page"
            disabled={scroll.currentPage >= scroll.totalPages}
            onClick={() => navigation?.scrollToNextPage("instant")}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </form>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="hidden @min-[28rem]:inline-flex"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={zoom.currentZoomLevel <= 0.25}
            onClick={() => magnification?.zoomOut()}
          >
            <HugeiconsIcon icon={Remove01Icon} />
          </Button>
          <SelectField
            label="PDF zoom"
            className="w-22 @min-[24rem]:w-25"
            value={String(zoom.zoomLevel)}
            items={zoomItems}
            onValueChange={(value) => {
              if (
                value === ZoomMode.Automatic ||
                value === ZoomMode.FitPage ||
                value === ZoomMode.FitWidth
              ) {
                magnification?.requestZoom(value);
              } else {
                magnification?.requestZoom(Number(value));
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="hidden @min-[28rem]:inline-flex"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={zoom.currentZoomLevel >= 3}
            onClick={() => magnification?.zoomIn()}
          >
            <HugeiconsIcon icon={Add01Icon} />
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            ref={searchButton}
            variant="ghost"
            size="icon"
            aria-label="Search PDF"
            title="Search PDF"
            aria-expanded={search.active}
            onClick={() =>
              search.active
                ? searchActions?.stopSearch()
                : searchActions?.startSearch()
            }
          >
            <HugeiconsIcon icon={Search01Icon} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rotate PDF clockwise"
            title="Rotate clockwise"
            onClick={() => rotation?.rotateForward()}
          >
            <HugeiconsIcon icon={RotateClockwiseIcon} />
          </Button>
          <a
            href={url}
            download
            aria-label="Download PDF"
            title="Download PDF"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <HugeiconsIcon icon={Download04Icon} />
          </a>
        </div>
      </div>
      {search.active && (
        <PdfSearch
          documentId={documentId}
          onClose={() => {
            searchActions?.stopSearch();
            searchButton.current?.focus();
          }}
        />
      )}
    </>
  );
}
