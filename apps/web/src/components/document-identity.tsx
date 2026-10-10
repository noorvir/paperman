import type { ComponentProps, ReactNode } from "react";
import { DocumentFileIcon } from "./document-file-icon";

export function DocumentIdentity({
  document,
  search,
  children,
}: {
  document: ComponentProps<typeof DocumentFileIcon>["document"];
  search?: ComponentProps<typeof DocumentFileIcon>["search"];
  children: ReactNode;
}) {
  const filename = document.final_path.slice(
    document.final_path.lastIndexOf("/") + 1,
  );
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className="relative z-10 shrink-0">
        <DocumentFileIcon document={document} search={search} />
      </div>
      <div className="min-w-0 flex-1">
        {children}
        <span
          className="document-caption mt-0.5 block font-normal"
          title={filename}
        >
          {filename}
        </span>
      </div>
    </div>
  );
}
