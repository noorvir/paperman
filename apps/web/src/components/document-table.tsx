import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { FileIcon } from "./file-icon";
import { DocumentTagPopover } from "./document-tag-popover";
import { OwnerLabel } from "./collection";
import { DocumentFilterLink } from "./document-filter-link";
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
  const owners = new Map(catalog.owners.map((owner) => [owner.id, owner.name]));
  return (
    <Table className="min-w-[640px] table-fixed [&_td]:py-2.5">
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead className="w-40">Owner</TableHead>
          <TableHead className="w-36">Tags</TableHead>
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
                  to="/documents/$documentId"
                  params={{ documentId: doc.id }}
                  search={{ ...search, preview: true, view: "pdf" }}
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
              <DocumentFilterLink
                search={search}
                filter={{ owner: [doc.owner_id] }}
                aria-label={`Filter by owner: ${owners.get(doc.owner_id) ?? doc.owner_id}`}
                className="-ml-1"
              >
                <OwnerLabel name={owners.get(doc.owner_id) ?? doc.owner_id} />
              </DocumentFilterLink>
            </TableCell>
            <TableCell>
              <DocumentTagPopover
                document={doc}
                catalog={catalog}
                search={search}
              />
            </TableCell>
          </CollectionRow>
        ))}
      </TableBody>
    </Table>
  );
}
