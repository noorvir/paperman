import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { getDocumentTags, getTagIcon } from "@/lib/catalog-icons";
import { DocumentMark } from "./document-mark";
import { OwnerLabel } from "./collection";
import { formatDate } from "./page";
import { Badge } from "./ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";

export function DocumentTable({
  documents,
  catalog,
  search,
  selectedId,
}: {
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
  search: z.output<typeof documentSearch>;
  selectedId: string | undefined;
}) {
  const owners = new Map(catalog.owners.map((entry) => [entry.id, entry.name]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[68%] md:w-[48%]">Document</TableHead>
          <TableHead className="hidden md:table-cell">Owner</TableHead>
          <TableHead className="hidden xl:table-cell">Tags</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const visibleTags = getDocumentTags(doc, catalog);
          return (
            <CollectionRow
              key={doc.id}
              data-state={selectedId === doc.id ? "selected" : undefined}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <DocumentMark document={doc} catalog={catalog} />
                  <div className="min-w-0">
                    <CollectionLink
                      itemId={doc.id}
                      selected={selectedId === doc.id}
                      to="/documents/$documentId"
                      params={{ documentId: doc.id }}
                      search={{ ...search, preview: true, view: "pdf" }}
                      resetScroll={false}
                      aria-label={`Preview ${doc.title}`}
                    >
                      {doc.title}
                    </CollectionLink>
                    <p className="document-caption">
                      {doc.summary ||
                        `${doc.source_pages.length} pages · Ready for tagging`}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <OwnerLabel name={owners.get(doc.owner_id) ?? doc.owner_id} />
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <div className="flex gap-1">
                  {doc.enrichment_status === "failed" ? (
                    <Badge variant="destructive">Tagging failed</Badge>
                  ) : (
                    visibleTags.slice(0, 2).map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        <HugeiconsIcon
                          icon={getTagIcon(tag)}
                          size={12}
                          aria-hidden="true"
                        />
                        {tag.name}
                      </Badge>
                    ))
                  )}
                  {visibleTags.length > 2 && (
                    <Badge variant="secondary">+{visibleTags.length - 2}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatDate(doc.document_date)}
              </TableCell>
            </CollectionRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
