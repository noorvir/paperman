import { Link, useNavigate } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { FileMark, OwnerLabel } from "./collection";
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
  const navigate = useNavigate();
  const owners = new Map(catalog.owners.map((entry) => [entry.id, entry.name]));
  const tags = new Map(catalog.tags.map((entry) => [entry.id, entry.name]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[68%] md:w-[48%]">Document</TableHead>
          <TableHead className="hidden md:table-cell">Owner</TableHead>
          <TableHead className="hidden xl:table-cell">Tags</TableHead>
          <TableHead className="text-right">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const visibleTags = [
            ...new Set([
              ...doc.generated_tags.filter(
                (tag) => !doc.excluded_tags.includes(tag),
              ),
              ...doc.user_tags,
            ]),
          ];
          return (
            <TableRow
              key={doc.id}
              data-state={selectedId === doc.id ? "selected" : undefined}
              className="cursor-pointer"
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest("a, button")
                ) {
                  return;
                }
                void navigate({
                  to: "/documents/$documentId",
                  params: { documentId: doc.id },
                  search: { ...search, preview: true, view: "pdf" },
                  resetScroll: false,
                });
              }}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <FileMark />
                  <div className="min-w-0">
                    <Link
                      id={`document-${doc.id}`}
                      to="/documents/$documentId"
                      params={{ documentId: doc.id }}
                      search={{ ...search, preview: true, view: "pdf" }}
                      resetScroll={false}
                      aria-label={`Preview ${doc.title}`}
                      aria-haspopup="dialog"
                      aria-expanded={selectedId === doc.id}
                      aria-current={selectedId === doc.id ? "true" : undefined}
                      className="document-link"
                    >
                      {doc.title}
                    </Link>
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
                    visibleTags.slice(0, 2).map((id) => (
                      <Badge key={id} variant="secondary">
                        {tags.get(id) ?? id}
                      </Badge>
                    ))
                  )}
                  {visibleTags.length > 2 && (
                    <Badge variant="secondary">+{visibleTags.length - 2}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {formatDate(doc.document_date)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
