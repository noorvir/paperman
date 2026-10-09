import { Link } from "@tanstack/react-router";
import { useAccess } from "./auth/access-context";
import { DocumentDelivery } from "./document-delivery";
import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { FileIcon } from "./file-icon";
import { DocumentTagPopover } from "./document-tag-popover";
import { DocumentOwners } from "./document-owners";
import { DocumentVerificationBadge } from "./document-verification-badge";
import { LocalTime } from "./local-time";
import { formatDate } from "./page";
import { Button } from "./ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownAZIcon,
  ArrowUpZAIcon,
  ArrowUpDownIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";

type Sort = z.output<typeof documentSearch>["sort"];
const columns: { label: string; asc: Sort; desc: Sort; className: string }[] = [
  { label: "Date", asc: "date_asc", desc: "date_desc", className: "w-28" },
  { label: "Document", asc: "title", desc: "title_desc", className: "" },
  {
    label: "Owners",
    asc: "owners_asc",
    desc: "owners_desc",
    className: "w-80",
  },
  { label: "Tags", asc: "tags_asc", desc: "tags_desc", className: "w-36" },
  {
    label: "Verification",
    asc: "verification_asc",
    desc: "verification_desc",
    className: "w-32 text-center",
  },
  {
    label: "Routing",
    asc: "delivery_asc",
    desc: "delivery_desc",
    className: "w-24 text-center",
  },
  {
    label: "Processed at",
    asc: "processed_asc",
    desc: "processed_desc",
    className: "w-48",
  },
];

export function DocumentTable({
  documents,
  catalog,
  search,
  selectedId,
  preview = true,
  onSort,
}: {
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
  search: z.output<typeof documentSearch>;
  selectedId: string | undefined;
  preview?: boolean;
  onSort?: (sort: z.output<typeof documentSearch>["sort"]) => void;
}) {
  const access = useAccess();
  const showDelivery = access.state === "authenticated";
  const filteredColumns: Partial<Record<Sort, boolean>> = {
    date_asc: Boolean(search.after || search.before),
    title: Boolean(search.q.trim()),
    owners_asc: search.owner.length > 0,
    tags_asc: search.tag.length > 0 || Boolean(search.status),
    delivery_asc: Boolean(search.delivery),
  };
  return (
    <Table className="min-w-[1180px] table-fixed [&_td]:py-2.5">
      <TableHeader>
        <TableRow>
          {columns
            .filter((column) => column.label !== "Routing" || showDelivery)
            .map((column) => {
              const direction =
                search.sort === column.asc
                  ? "ascending"
                  : search.sort === column.desc
                    ? "descending"
                    : "none";
              return (
                <TableHead
                  key={column.label}
                  className={column.className}
                  aria-sort={onSort ? direction : undefined}
                >
                  {onSort ? (
                    <Button
                      variant="ghost"
                      className="-ml-2"
                      onClick={() =>
                        onSort(
                          search.sort === column.asc ? column.desc : column.asc,
                        )
                      }
                    >
                      {column.label}
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={
                          direction === "ascending"
                            ? ArrowDownAZIcon
                            : direction === "descending"
                              ? ArrowUpZAIcon
                              : ArrowUpDownIcon
                        }
                      />
                      {filteredColumns[column.asc] && (
                        <HugeiconsIcon
                          icon={FilterIcon}
                          role="img"
                          aria-label="Filter applied"
                        />
                      )}
                    </Button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              );
            })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <CollectionRow key={doc.id} itemId={doc.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              <time dateTime={doc.document_date}>
                {formatDate(doc.document_date)}
              </time>
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <FileIcon filename={doc.final_path} />
                <CollectionLink
                  itemId={doc.id}
                  selected={selectedId === doc.id}
                  preview={preview}
                  {...(preview
                    ? {
                        to: "/documents",
                        search: { ...search, preview: doc.id, view: "pdf" },
                      }
                    : {
                        to: "/documents/$documentId",
                        params: { documentId: doc.id },
                        search: { ...search, view: "pdf" },
                      })}
                  resetScroll={false}
                  title={doc.final_path.slice(
                    doc.final_path.lastIndexOf("/") + 1,
                  )}
                  aria-label={`${preview ? "Preview" : "Open"} ${doc.title}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate">{doc.title}</span>
                  <span className="document-caption mt-0.5 block font-normal">
                    {doc.final_path.slice(doc.final_path.lastIndexOf("/") + 1)}
                  </span>
                </CollectionLink>
              </div>
            </TableCell>
            <TableCell>
              <DocumentOwners
                ownerIds={doc.owner_ids}
                inline
                owners={catalog.owners}
                search={search}
              />
            </TableCell>
            <TableCell>
              <DocumentTagPopover
                document={doc}
                catalog={catalog}
                search={search}
              />
            </TableCell>
            <TableCell className="text-center">
              <DocumentVerificationBadge
                verification={doc.verification}
                render={
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: doc.id }}
                    search={{ ...search, view: "pdf" }}
                  />
                }
              />
            </TableCell>
            {showDelivery && (
              <TableCell className="text-center">
                <DocumentDelivery
                  document={doc}
                  render={
                    <Link
                      to="/documents/$documentId"
                      params={{ documentId: doc.id }}
                      search={{ ...search, view: "pdf" }}
                    />
                  }
                />
              </TableCell>
            )}
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              <LocalTime value={doc.processed_at} />
            </TableCell>
          </CollectionRow>
        ))}
      </TableBody>
    </Table>
  );
}
