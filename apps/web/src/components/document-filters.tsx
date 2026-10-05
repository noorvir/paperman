import { useState } from "react";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterHorizontalIcon,
  ArrowDown01Icon,
  Cancel01Icon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  SortingAZ01Icon,
} from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { documentSearch } from "@/lib/queries";
import { getTagIcon } from "@/lib/catalog-icons";
import { Button } from "./ui/button";
import { MultiSelectFilter } from "./multi-select-filter";
import { DateRangeFilter } from "./date-range-filter";
import { SelectField } from "./select-field";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./ui/dropdown-menu";

type Search = z.output<typeof documentSearch>;
export function DocumentFilters({
  search,
  catalog,
  onChange,
}: {
  search: Search;
  catalog: components["schemas"]["Catalog"];
  onChange: (search: Search) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = [
    search.owner.length,
    search.tag.length,
    search.after || search.before,
    search.status,
  ].filter(Boolean).length;
  function change(filter: Partial<Search>) {
    onChange({ ...search, ...filter, page: 1 });
  }
  function reset() {
    change({ owner: [], tag: [], after: "", before: "", status: "" });
  }
  const fields = (
    <>
      <div className="w-full min-w-0 shrink-0 @min-[74rem]/library:w-32">
        <MultiSelectFilter
          label="Owners"
          value={search.owner}
          items={catalog.owners.map((entry) => ({
            value: entry.id,
            label: entry.name,
          }))}
          onChange={(owner) => change({ owner })}
        />
      </div>
      <div className="w-full min-w-0 shrink-0 @min-[74rem]/library:w-32">
        <MultiSelectFilter
          label="Tags"
          value={search.tag}
          items={catalog.tags.map((entry) => ({
            value: entry.id,
            label: entry.name,
            icon: <HugeiconsIcon icon={getTagIcon(entry)} />,
          }))}
          onChange={(tag) => change({ tag })}
        />
      </div>
      <DateRangeFilter
        after={search.after}
        before={search.before}
        onChange={change}
      />
      <div className="w-full shrink-0 @min-[74rem]/library:w-28">
        <SelectField
          label="Tagging status"
          value={search.status}
          onValueChange={(status) =>
            change({ status: documentSearch.shape.status.parse(status) })
          }
          items={[
            { value: "", label: "Any status" },
            { value: "complete", label: "Complete" },
            { value: "pending", label: "Pending" },
            { value: "running", label: "Processing" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </div>
    </>
  );
  return (
    <>
      <div className="hidden shrink-0 items-center gap-2 @min-[74rem]/library:flex">
        {fields}
        {count > 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset filters"
            onClick={reset}
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        )}
      </div>
      <div className="@min-[74rem]/library:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" />}>
            <HugeiconsIcon icon={FilterHorizontalIcon} />
            Filters{count > 0 && ` (${count})`}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 gap-3 p-3">
            <PopoverTitle>Filter documents</PopoverTitle>
            {fields}
            <div className="flex justify-between border-t pt-3">
              <Button variant="ghost" disabled={!count} onClick={reset}>
                Reset filters
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

export function DocumentSort({
  value,
  onChange,
}: {
  value: Search["sort"];
  onChange: (sort: Search["sort"]) => void;
}) {
  const options = {
    date_desc: { label: "Newest first", icon: CalendarArrowDownIcon },
    date_asc: { label: "Oldest first", icon: CalendarArrowUpIcon },
    title: { label: "Title A–Z", icon: SortingAZ01Icon },
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" />}
        aria-label="Sort documents"
      >
        <HugeiconsIcon icon={options[value].icon} />
        {options[value].label}
        <HugeiconsIcon icon={ArrowDown01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-max min-w-(--anchor-width) max-w-(--available-width)"
      >
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(sort) =>
            onChange(documentSearch.shape.sort.parse(sort))
          }
        >
          {documentSearch.shape.sort.unwrap().options.map((sort) => (
            <DropdownMenuRadioItem key={sort} value={sort}>
              <HugeiconsIcon icon={options[sort].icon} />
              {options[sort].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
