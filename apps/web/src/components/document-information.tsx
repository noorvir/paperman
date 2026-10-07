import type { ComponentProps } from "react";
import type { components } from "@/lib/schema";
import { DocumentOwners } from "./document-owners";
import { DocumentTags } from "./document-tags";
import { LocalTime } from "./local-time";
import { formatDate } from "./page";
import { FileLink } from "./file-link";

export function DocumentInformation({
  document,
  scanName,
  catalog,
  search,
  allowActions,
}: {
  document: components["schemas"]["Document"];
  scanName: string;
  catalog: components["schemas"]["Catalog"];
  search: ComponentProps<typeof DocumentTags>["search"];
  allowActions: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-xs">
      <h2 className="workspace-title break-words">{document.title}</h2>
      <dl className="space-y-4">
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Owners</dt>
          <dd>
            <DocumentOwners
              ownerIds={document.owner_ids}
              owners={catalog.owners}
              search={search}
            />
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Document date</dt>
          <dd>{formatDate(document.document_date)}</dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Processed at</dt>
          <dd>
            <LocalTime value={document.processed_at} />
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Scanned at</dt>
          <dd>
            <LocalTime value={document.scanned_at} />
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Source scan</dt>
          <dd>
            <FileLink
              to="/scans/$scanId"
              params={{ scanId: document.scan_id }}
              search={{ preview: true }}
              filename={scanName}
            />
          </dd>
        </div>
      </dl>
      <DocumentTags
        document={document}
        catalog={catalog}
        search={search}
        allowActions={allowActions}
      />
    </div>
  );
}
