import type { ComponentProps, ReactNode } from "react";
import type { components } from "@/lib/schema";
import { DocumentCreators } from "./document-creators";
import { DocumentOwners } from "./document-owners";
import { DocumentTags } from "./document-tags";
import { LocalTime } from "./local-time";
import { formatDate } from "./page";

export function DocumentInformation({
  document,
  sourceLink,
  catalog,
  search,
  allowActions,
  viewControls,
}: {
  document: components["schemas"]["Document"];
  sourceLink: ReactNode;
  catalog: components["schemas"]["Catalog"];
  search: ComponentProps<typeof DocumentTags>["search"];
  allowActions: boolean;
  viewControls?: ReactNode;
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
          <dt className="text-muted-foreground">Created by</dt>
          <dd>
            <DocumentCreators
              document={document}
              catalog={catalog}
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
        {sourceLink && (
          <div className="space-y-1.5">
            <dt className="text-muted-foreground">Source scan</dt>
            <dd>{sourceLink}</dd>
          </div>
        )}
      </dl>
      {viewControls}
      <DocumentTags
        document={document}
        catalog={catalog}
        search={search}
        allowActions={allowActions}
      />
    </div>
  );
}
