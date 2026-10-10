import { useRender } from "@base-ui/react/use-render";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDownAZIcon,
  ArrowUpZAIcon,
  ArrowUpDownIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import type { z } from "zod";
import type { documentSearch } from "@/lib/search";
import { Button } from "./ui/button";

type Sort = z.output<typeof documentSearch>["sort"];
type SortField = { asc: Sort; desc: Sort };

export function sortDirection(sort: Sort | undefined, field: SortField) {
  if (sort === field.asc) return "ascending";
  if (sort === field.desc) return "descending";
  return "none";
}

export function DocumentSortButton({
  sort,
  asc,
  desc,
  onSort,
  filtered,
  children,
  render = <Button variant="ghost" />,
  ...props
}: Omit<useRender.ComponentProps<"button">, "onClick"> &
  SortField & {
    sort: Sort | undefined;
    onSort: (sort: Sort) => void;
    filtered?: boolean;
  }) {
  const direction = sortDirection(sort, { asc, desc });
  return useRender({
    render,
    props: {
      ...props,
      onClick: () => onSort(sort === asc ? desc : asc),
      "aria-description":
        direction === "none" ? undefined : `Sorted ${direction}`,
      children: (
        <>
          {children}
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
          {filtered && (
            <HugeiconsIcon
              icon={FilterIcon}
              role="img"
              aria-label="Filter applied"
            />
          )}
        </>
      ),
    },
  });
}
