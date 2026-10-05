import type { ReactNode } from "react";

export function PdfToolbarLayout({
  pages,
  zoom,
  actions,
}: {
  pages: ReactNode;
  zoom: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="pdf-toolbar" role="group" aria-label="PDF controls">
      <div className="flex shrink-0 items-center gap-1">{pages}</div>
      <div className="flex shrink-0 items-center gap-1">{zoom}</div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}
