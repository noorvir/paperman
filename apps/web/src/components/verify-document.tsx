import { Link, linkOptions } from "@tanstack/react-router";
import { BadgeAlertIcon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import type { z } from "zod";
import type { documentSearch, documentView } from "@/lib/queries";
import { PreviewAction } from "./preview-action";

export function VerifyDocument({
  document,
  search,
  view,
}: {
  document: components["schemas"]["Document"];
  search: z.output<typeof documentSearch>;
  view: z.output<typeof documentView>;
}) {
  if (document.verification) {
    return null;
  }
  const link = linkOptions({
    to: "/documents/$documentId",
    params: { documentId: document.id },
    search: { ...search, view, verify: true },
    resetScroll: false,
  });
  return (
    <PreviewAction
      icon={BadgeAlertIcon}
      variant="attention"
      nativeButton={false}
      render={<Link {...link} />}
    >
      Verify
    </PreviewAction>
  );
}
