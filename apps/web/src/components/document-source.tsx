import type { ComponentProps } from "react";
import { PdfPreview } from "./pdf-preview";
import { ScanInformation } from "./scan-information";

export function DocumentSource({
  source,
  pages,
  sidebar,
}: {
  source: ComponentProps<typeof ScanInformation>;
  pages: number[];
  sidebar: boolean;
}) {
  return (
    <>
      <details
        className={`max-h-1/2 shrink-0 overflow-auto border-b pb-3 text-xs ${sidebar ? "detail-information-compact" : ""}`}
      >
        <summary className="cursor-pointer py-2 font-medium">
          Source scan details
        </summary>
        <ScanInformation {...source} />
      </details>
      <PdfPreview
        url={`/api/scans/${source.scan.id}/pdf`}
        title={`Source scan: ${source.scan.original_name}`}
        initialPage={pages[0]}
        highlightedPages={pages}
      />
    </>
  );
}
