import { Link } from "@tanstack/react-router";
import { documentSearch } from "@/lib/queries";
import type { components } from "@/lib/schema";
import { CollectionLink, CollectionRow } from "./collection-workspace";
import { OwnerAvatar } from "./collection";
import { DocumentOwners } from "./document-owners";
import { DocumentVerificationBadge } from "./document-verification-badge";
import { DocumentFileIcon } from "./document-file-icon";
import { DocumentTagPopover } from "./document-tag-popover";
import { formatDate } from "./page";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function OverviewDocumentTable({
  documents,
  catalog,
}: {
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
}) {
  const search = documentSearch.parse({});
  return (
    <div className="@container/overview [&>[data-slot=table-container]]:overflow-visible">
      <Table className="table-fixed [&_td]:px-2 [&_th]:px-2">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="hidden w-24 @sm/overview:table-cell">
              Date
            </TableHead>
            <TableHead>Document</TableHead>
            <TableHead className="w-12 text-center @lg/overview:w-16 @min-[40rem]/overview:w-48">
              <span className="sr-only @lg/overview:not-sr-only">Owners</span>
            </TableHead>
            <TableHead className="hidden w-48 @min-[48rem]/overview:table-cell">
              Tags
            </TableHead>
            <TableHead className="w-10 text-center @lg/overview:w-24">
              <span className="sr-only @lg/overview:not-sr-only">
                Verification
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const names = document.owner_ids.map(
              (id) =>
                catalog.owners.find((owner) => owner.id === id)?.name ?? id,
            );
            return (
              <CollectionRow key={document.id} itemId={document.id}>
                <TableCell className="hidden text-muted-foreground @sm/overview:table-cell">
                  <time dateTime={document.document_date}>
                    {formatDate(document.document_date)}
                  </time>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <DocumentFileIcon document={document} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <CollectionLink
                          itemId={document.id}
                          selected={false}
                          to="/documents"
                          search={{ preview: document.id, view: "pdf" }}
                          aria-label={`Preview ${document.title}`}
                          className="min-w-0 max-w-full"
                          title={document.title}
                        >
                          <span className="line-clamp-2 whitespace-normal">
                            {document.title}
                          </span>
                        </CollectionLink>
                        <span className="contents @min-[48rem]/overview:hidden">
                          <DocumentTagPopover
                            compact
                            document={document}
                            catalog={catalog}
                            search={search}
                          />
                        </span>
                      </div>
                      <span className="document-caption mt-0.5 hidden font-normal @sm/overview:block">
                        {document.final_path.slice(
                          document.final_path.lastIndexOf("/") + 1,
                        )}
                      </span>
                      <time
                        dateTime={document.document_date}
                        className="mt-0.5 block font-normal text-muted-foreground @sm/overview:hidden"
                      >
                        {formatDate(document.document_date)}
                      </time>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="hidden @min-[40rem]/overview:block">
                    <DocumentOwners
                      compact
                      ownerIds={document.owner_ids}
                      owners={catalog.owners}
                      search={search}
                    />
                  </div>
                  <span className="@min-[40rem]/overview:hidden">
                    <Tooltip>
                      <TooltipTrigger
                        render={<span />}
                        tabIndex={0}
                        aria-label={`Owners: ${names.join(", ")}`}
                        className="inline-flex items-center gap-1 rounded-sm align-middle outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <OwnerAvatar name={names[0] ?? "Unknown"} />
                        {names.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{names.length - 1}
                          </span>
                        )}
                      </TooltipTrigger>
                      <TooltipContent>{names.join(", ")}</TooltipContent>
                    </Tooltip>
                  </span>
                </TableCell>
                <DocumentTagPopover
                  compact
                  document={document}
                  catalog={catalog}
                  search={search}
                  render={
                    <TableCell className="hidden @min-[48rem]/overview:table-cell" />
                  }
                />
                <TableCell className="text-center">
                  <DocumentVerificationBadge
                    verification={document.verification}
                    render={
                      <Link
                        to="/documents/$documentId"
                        params={{ documentId: document.id }}
                        search={{ view: "pdf" }}
                      />
                    }
                  />
                </TableCell>
              </CollectionRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
