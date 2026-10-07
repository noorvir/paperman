import { Link, linkOptions } from "@tanstack/react-router";
import type { z } from "zod";
import type { documentSearch, documentView } from "@/lib/queries";

export function DocumentTabs({
  documentId,
  search,
  view,
  preview,
  edit,
}: {
  documentId: string;
  search: z.output<typeof documentSearch>;
  view: z.output<typeof documentView>;
  preview: boolean;
  edit: boolean;
}) {
  const views: (typeof view)[] = ["pdf", "text", "summary", "details"];
  return (
    <nav aria-label="Document view" className="view-tabs">
      {views.map((tab) => {
        const link = preview
          ? linkOptions({
              to: "/documents",
              search: { ...search, preview: documentId, view: tab },
            })
          : linkOptions({
              to: "/documents/$documentId",
              params: { documentId },
              search: { ...search, view: tab, edit },
            });
        return (
          <Link
            key={tab}
            {...link}
            replace
            resetScroll={false}
            data-active={view === tab}
            aria-current={view === tab ? "page" : undefined}
          >
            {
              {
                pdf: "PDF",
                text: "Text",
                summary: "Summary",
                details: "Details",
              }[tab]
            }
          </Link>
        );
      })}
    </nav>
  );
}
