import { Link } from "@tanstack/react-router";
import { useAccess } from "./auth/access-context";
import { DocumentDelivery } from "./document-delivery";
import type { components } from "@/lib/schema";
import { CollectionLink, CollectionRow } from "./collection-workspace";
import { OwnerAvatar } from "./collection";
import { DocumentVerificationBadge } from "./document-verification-badge";
import { FileIcon } from "./file-icon";
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
  const access = useAccess();
  const showDelivery = access.state === "authenticated";
  return (
    <div className="@container/overview [&>[data-slot=table-container]]:overflow-visible">
      <Table className="table-fixed [&_td]:px-2 [&_th]:px-2">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="hidden w-24 @sm/overview:table-cell">
              Date
            </TableHead>
            <TableHead>Document</TableHead>
            <TableHead className="w-12 text-center @lg/overview:w-16">
              <span className="sr-only @lg/overview:not-sr-only">Owners</span>
            </TableHead>
            <TableHead className="w-10 text-center @lg/overview:w-24">
              <span className="sr-only @lg/overview:not-sr-only">
                Verification
              </span>
            </TableHead>
            {showDelivery && (
              <TableHead className="w-10 text-center @lg/overview:w-20">
                <span className="sr-only @lg/overview:not-sr-only">
                  Routing
                </span>
              </TableHead>
            )}
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
                    <span className="hidden @lg/overview:block">
                      <FileIcon filename={document.final_path} />
                    </span>
                    <CollectionLink
                      itemId={document.id}
                      selected={false}
                      to="/documents"
                      search={{ preview: document.id, view: "pdf" }}
                      aria-label={`Preview ${document.title}`}
                      className="min-w-0 flex-1"
                      title={document.title}
                    >
                      <span className="line-clamp-2 whitespace-normal @sm/overview:block @sm/overview:truncate">
                        {document.title}
                      </span>
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
                    </CollectionLink>
                  </div>
                </TableCell>
                <TableCell className="text-center">
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
                </TableCell>
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
                {showDelivery && (
                  <TableCell className="text-center">
                    <DocumentDelivery
                      document={document}
                      render={
                        <Link
                          to="/documents/$documentId"
                          params={{ documentId: document.id }}
                          search={{ view: "pdf" }}
                        />
                      }
                    />
                  </TableCell>
                )}
              </CollectionRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
