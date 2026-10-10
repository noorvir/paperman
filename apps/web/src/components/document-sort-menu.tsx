import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { z } from "zod";
import type { documentSearch } from "@/lib/search";
import { DocumentSortButton, DocumentSortIcon } from "./document-sort-button";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";

export function DocumentSortMenu({
  sort,
  onChange,
}: {
  sort: z.output<typeof documentSearch>["sort"];
  onChange: (sort: z.output<typeof documentSearch>["sort"]) => void;
}) {
  const label = sortLabels[sort];
  const direction = sort.endsWith("_desc") ? "descending" : "ascending";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" />}
        aria-label={`Sort by ${label}, ${direction}`}
      >
        <DocumentSortIcon direction={direction} />
        {label}
        <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DocumentSortButton
          render={<DropdownMenuItem />}
          className="w-full justify-between"
          sort={sort}
          asc="date_asc"
          desc="date_desc"
          onSort={onChange}
        >
          Date
        </DocumentSortButton>
        <DocumentSortButton
          render={<DropdownMenuItem />}
          className="w-full justify-between"
          sort={sort}
          asc="processed_asc"
          desc="processed_desc"
          onSort={onChange}
        >
          Processed at
        </DocumentSortButton>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const sortLabels: Record<z.output<typeof documentSearch>["sort"], string> = {
  date_asc: "Date",
  date_desc: "Date",
  title: "Document",
  title_desc: "Document",
  owners_asc: "Owners",
  owners_desc: "Owners",
  creators_asc: "Created by",
  creators_desc: "Created by",
  tags_asc: "Tags",
  tags_desc: "Tags",
  verification_asc: "Verification",
  verification_desc: "Verification",
  delivery_asc: "Routing",
  delivery_desc: "Routing",
  processed_asc: "Processed at",
  processed_desc: "Processed at",
};
