import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { FileIcon } from "./file-icon";
import { DocumentTagPopover } from "./document-tag-popover";
import { DocumentOwners } from "./document-owners";
import { LocalTime } from "./local-time";
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
  return (
    <Table className="min-w-[800px] table-fixed [&_td]:py-2.5">
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead className="w-40">Owners</TableHead>
          <TableHead className="w-36">Tags</TableHead>
          <TableHead className="w-48">Processed at</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <CollectionRow key={doc.id} itemId={doc.id}>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <FileIcon filename={doc.final_path} />
                <CollectionLink
                  itemId={doc.id}
                  selected={selectedId === doc.id}
                  to="/documents"
                  search={{ ...search, preview: doc.id, view: "pdf" }}
                  resetScroll={false}
                  title={doc.final_path.slice(
                    doc.final_path.lastIndexOf("/") + 1,
                  )}
                  aria-label={`Preview ${doc.title}`}
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
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              <LocalTime value={doc.processed_at} />
            </TableCell>
          </CollectionRow>
        ))}
      </TableBody>
    </Table>
  );
}
