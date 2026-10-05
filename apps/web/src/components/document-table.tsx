import { CollectionLink, CollectionRow } from "./collection-workspace";
import type { components } from "@/lib/schema";
import type { documentSearch } from "@/lib/queries";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon } from "@hugeicons/core-free-icons";
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
    <Table className="min-w-[920px] table-fixed [&_td]:py-2.5">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[36%]">Name</TableHead>
          <TableHead className="w-[23%]">Title</TableHead>
          <TableHead className="w-[14%]">Owner</TableHead>
          <TableHead className="w-[12%]">Tag</TableHead>
          <TableHead className="w-[15%]">Location</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const filename = doc.final_path.slice(
            doc.final_path.lastIndexOf("/") + 1,
          );
          const folder = doc.final_path.slice(
            0,
            doc.final_path.lastIndexOf("/"),
          );
          return (
            <CollectionRow key={doc.id} itemId={doc.id}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <FileIcon filename={filename} />
                  <CollectionLink
                    itemId={doc.id}
                    selected={selectedId === doc.id}
                    to="/documents/$documentId"
                    params={{ documentId: doc.id }}
                    search={{ ...search, preview: true, view: "pdf" }}
                    resetScroll={false}
                    title={doc.final_path}
                    aria-label={`Preview ${doc.title}`}
                  >
                    <span className="flex min-w-0 font-normal">
                      <span className="truncate">{filename.slice(0, -4)}</span>
                      <span className="shrink-0">.pdf</span>
                    </span>
                  </CollectionLink>
                </div>
              </TableCell>
              <TableCell>
                <span className="block truncate" title={doc.title}>
                  {doc.title}
                </span>
              </TableCell>
              <TableCell>
                <DocumentFilterLink
                  search={search}
                  filter={{ owner: doc.owner_id }}
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
              <TableCell>
                <span
                  className="flex items-center gap-2 text-muted-foreground"
                  title={folder}
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{folder}/</span>
                </span>
              </TableCell>
            </CollectionRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
