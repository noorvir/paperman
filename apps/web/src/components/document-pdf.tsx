import { useState, type ComponentProps } from "react";
import { cn } from "cn";
import { PdfPreview } from "./pdf-preview";

export function DocumentPdf({
  source,
  showContext,
  ...pdf
}: Pick<
  ComponentProps<typeof PdfPreview>,
  "url" | "title" | "rotations" | "onRotatePage"
> & {
  source: { url: string; title: string; pages: number[] } | null;
  showContext: boolean;
}) {
  const [openedContext, setOpenedContext] = useState(showContext);
  if (showContext && !openedContext) {
    setOpenedContext(true);
  }

  return (
    <div className="document-panels">
      <div
        className={cn(
          "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col",
          showContext && "invisible",
        )}
        aria-hidden={showContext}
        inert={showContext}
      >
        <PdfPreview {...pdf} />
      </div>
      <div
        className={cn(
          "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col",
          !showContext && "invisible",
        )}
        role="group"
        aria-label="Document in source scan"
        aria-hidden={!showContext}
        inert={!showContext}
      >
        {openedContext && source && (
          <PdfPreview
            url={source.url}
            title={source.title}
            initialPage={source.pages[0]}
            highlightedPages={source.pages}
          />
        )}
      </div>
    </div>
  );
}
