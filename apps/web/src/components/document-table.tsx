import {
  defaultDocumentColumns,
  type DocumentColumns,
} from "@/hooks/use-document-columns";
import type { CSSProperties } from "react";
import { LocalTime } from "./local-time";
import { Link } from "@tanstack/react-router";
import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { DocumentFileIcon } from "./document-file-icon";
import { DocumentTagPopover } from "./document-tag-popover";
import { DocumentCreators } from "./document-creators";
import { DocumentOwners } from "./document-owners";
import { DocumentVerificationBadge } from "./document-verification-badge";
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
const columns: {
  key: keyof DocumentColumns | "document";
  label: string;
  asc: Sort;
  desc: Sort;
  className: string;
}[] = [
  {
    key: "date",
    label: "Date",
    asc: "date_asc",
    desc: "date_desc",
    className: "w-28",
  },
  {
    key: "document",
    label: "Document",
    asc: "title",
    desc: "title_desc",
    className: "",
  },
  {
    key: "owners",
    label: "Owners",
    asc: "owners_asc",
    desc: "owners_desc",
    className: "w-48",
  },
  {
    key: "creators",
    label: "Creator",
    asc: "creators_asc",
    desc: "creators_desc",
    className: "w-80",
  },
  {
    key: "tags",
    label: "Tags",
    asc: "tags_asc",
    desc: "tags_desc",
    className: "hidden w-56 @min-[84rem]/library:table-cell",
  },
  {
    key: "verification",
    label: "Verification",
    asc: "verification_asc",
    desc: "verification_desc",
    className: "w-28 text-center",
  },
  {
    key: "processed",
    label: "Processed at",
    asc: "processed_asc",
    desc: "processed_desc",
    className: "w-44",
  },
];

export function DocumentTable({
  documents,
  catalog,
  search,
  selectedId,
  preview = true,
  onSort,
  visibleColumns = defaultDocumentColumns,
}: {
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
  search: z.output<typeof documentSearch>;
  selectedId: string | undefined;
  preview?: boolean;
  visibleColumns?: DocumentColumns;
  onSort?: (sort: z.output<typeof documentSearch>["sort"]) => void;
}) {
  const filteredColumns: Partial<Record<Sort, boolean>> = {
    date_asc: Boolean(search.after || search.before),
    title: Boolean(search.q.trim()),
    owners_asc: search.owner.length > 0,
    creators_asc: search.creator.length > 0,
    tags_asc: search.tag.length > 0 || Boolean(search.status),
  };
  const width =
    256 +
    (visibleColumns.date ? 112 : 0) +
    (visibleColumns.owners ? 192 : 0) +
    (visibleColumns.creators ? 320 : 0) +
    (visibleColumns.verification ? 112 : 0) +
    (visibleColumns.processed ? 176 : 0);
  const style: CSSProperties & {
    "--table-width": string;
    "--table-wide-width": string;
  } = {
    "--table-width": `${width}px`,
    "--table-wide-width": `${width + (visibleColumns.tags ? 224 : 0)}px`,
  };
  return (
    <Table
      style={style}
      className="min-w-(--table-width) table-fixed @min-[84rem]/library:min-w-(--table-wide-width) [&_td]:py-2.5"
    >
      <TableHeader>
        <TableRow>
          {columns
            .filter(
              (column) =>
                column.key === "document" || visibleColumns[column.key],
            )
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
            {visibleColumns.date && (
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                <time dateTime={doc.document_date}>
                  {formatDate(doc.document_date)}
                </time>
              </TableCell>
            )}
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <DocumentFileIcon document={doc} search={search} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
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
                      className="min-w-0 max-w-full"
                    >
                      <span className="line-clamp-2 whitespace-normal">
                        {doc.title}
                      </span>
                    </CollectionLink>
                    {visibleColumns.tags && (
                      <span className="contents @min-[84rem]/library:hidden">
                        <DocumentTagPopover
                          compact
                          document={doc}
                          catalog={catalog}
                          search={search}
                        />
                      </span>
                    )}
                  </div>
                  <span className="document-caption mt-0.5 block font-normal">
                    {doc.final_path.slice(doc.final_path.lastIndexOf("/") + 1)}
                  </span>
                </div>
              </div>
            </TableCell>
            {visibleColumns.owners && (
              <TableCell>
                <DocumentOwners
                  ownerIds={doc.owner_ids}
                  compact
                  owners={catalog.owners}
                  search={search}
                />
              </TableCell>
            )}
            {visibleColumns.creators && (
              <TableCell>
                <DocumentCreators
                  compact
                  document={doc}
                  catalog={catalog}
                  search={search}
                />
              </TableCell>
            )}
            {visibleColumns.tags && (
              <DocumentTagPopover
                compact
                document={doc}
                catalog={catalog}
                search={search}
                render={
                  <TableCell className="hidden @min-[84rem]/library:table-cell" />
                }
              />
            )}
            {visibleColumns.verification && (
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
            )}
            {visibleColumns.processed && (
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                <LocalTime value={doc.processed_at} />
              </TableCell>
            )}
          </CollectionRow>
        ))}
      </TableBody>
    </Table>
  );
}
