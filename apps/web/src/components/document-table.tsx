import { defaultDocumentColumns, type DocumentColumns } from "@/lib/search";
import { LocalTime } from "./local-time";
import { Link } from "@tanstack/react-router";
import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import { documentSearch } from "@/lib/search";
import type { z } from "zod";
import { DocumentIdentity } from "./document-identity";
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
    className: "min-w-28",
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
    className: "min-w-48",
  },
  {
    key: "creators",
    label: "Created by",
    asc: "creators_asc",
    desc: "creators_desc",
    className: "min-w-80",
  },
  {
    key: "tags",
    label: "Tags",
    asc: "tags_asc",
    desc: "tags_desc",
    className: "min-w-56",
  },
  {
    key: "verification",
    label: "Verification",
    asc: "verification_asc",
    desc: "verification_desc",
    className: "min-w-28 text-center",
  },
  {
    key: "processed",
    label: "Processed at",
    asc: "processed_asc",
    desc: "processed_desc",
    className: "min-w-44",
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
  search: Partial<z.output<typeof documentSearch>>;
  selectedId: string | undefined;
  preview?: boolean;
  visibleColumns?: DocumentColumns;
  onSort?: (sort: z.output<typeof documentSearch>["sort"]) => void;
}) {
  const filters = documentSearch.parse(search);
  const filteredColumns: Partial<Record<Sort, boolean>> = {
    date_asc: Boolean(filters.after || filters.before),
    title: Boolean(filters.q.trim()),
    owners_asc: filters.owner.length > 0,
    creators_asc: filters.creator.length > 0,
    tags_asc: filters.tag.length > 0 || Boolean(filters.status),
  };
  return (
    <Table className="w-max min-w-full table-auto [&_td]:py-2.5">
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
            <TableCell className="[&_.document-caption]:max-w-md">
              <DocumentIdentity document={doc} search={search}>
                <CollectionLink
                  itemId={doc.id}
                  selected={selectedId === doc.id}
                  preview={preview}
                  {...(preview
                    ? {
                        to: "/documents",
                        search: { ...search, preview: doc.id },
                      }
                    : {
                        to: "/documents/$documentId",
                        params: { documentId: doc.id },
                        search: { ...search },
                      })}
                  resetScroll={false}
                  title={doc.final_path.slice(
                    doc.final_path.lastIndexOf("/") + 1,
                  )}
                  aria-label={`${preview ? "Preview" : "Open"} ${doc.title}`}
                  className="w-max overflow-visible text-clip whitespace-nowrap"
                >
                  {doc.title}
                </CollectionLink>
              </DocumentIdentity>
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
                render={<TableCell />}
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
                      search={{ ...search }}
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
