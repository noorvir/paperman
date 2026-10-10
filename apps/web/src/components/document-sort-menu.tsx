import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { z } from "zod";
import type { documentSearch } from "@/lib/search";
import { DocumentSortButton } from "./document-sort-button";
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Sort
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
