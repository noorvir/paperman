import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { DocumentDelivery } from "./document-delivery";
import { DocumentFilterLink } from "./document-filter-link";
import { FileIcon } from "./file-icon";

export function DocumentFileIcon({
  document,
  search,
  size = "sm",
}: {
  document: ComponentProps<typeof DocumentDelivery>["document"];
  search?: ComponentProps<typeof DocumentFilterLink>["search"];
  size?: ComponentProps<typeof FileIcon>["size"];
}) {
  return (
    <span className="relative inline-flex shrink-0 pt-1.5 pr-1.5">
      <FileIcon filename={document.final_path} size={size} />
      <span className="absolute top-0 right-0 inline-flex">
        <DocumentDelivery
          document={document}
          marker
          render={
            <Link
              to="/documents/$documentId"
              params={{ documentId: document.id }}
              search={search}
            />
          }
        />
      </span>
    </span>
  );
}
