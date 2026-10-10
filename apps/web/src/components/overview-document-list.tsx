import { documentSearch } from "@/lib/queries";
import type { components } from "@/lib/schema";
import { CollectionLink } from "./collection-workspace";
import { DocumentIdentity } from "./document-identity";
import { DocumentOwners } from "./document-owners";
import { formatDate } from "./page";

export function OverviewDocumentList({
  documents,
  catalog,
}: {
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
}) {
  const search = documentSearch.parse({});
  return (
    <ul className="@container/recent space-y-2">
      {documents.map((document) => (
        <li
          key={document.id}
          className="relative grid min-w-0 grid-cols-1 items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 hover:bg-accent/30 has-[[data-collection-link]:focus-visible]:bg-accent/50 @min-[40rem]/recent:grid-cols-[minmax(0,1fr)_auto]"
        >
          <DocumentIdentity document={document}>
            <CollectionLink
              itemId={document.id}
              selected={false}
              to="/documents"
              search={{ preview: document.id, view: "pdf" }}
              aria-label={`Preview ${document.title}`}
              title={document.title}
              className="after:absolute after:inset-0 after:rounded-lg"
            >
              {document.title}
            </CollectionLink>
          </DocumentIdentity>
          <div className="flex items-center justify-self-end gap-3 text-xs">
            <div className="relative z-10">
              <DocumentOwners
                compact
                ownerIds={document.owner_ids}
                owners={catalog.owners}
                search={search}
              />
            </div>
            <time
              dateTime={document.document_date}
              className="text-right whitespace-nowrap text-muted-foreground"
            >
              {formatDate(document.document_date)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
