import { useState, type FormEvent } from "react";
import { z } from "zod";
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
import { Button } from "./ui/button";
import { DatePicker } from "./date-picker";
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
  DropdownMenuItem,
} from "./ui/dropdown-menu";

type Search = z.infer<typeof documentSearch>;
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
    search.owner,
    search.tag,
    search.after,
    search.before,
    search.status,
  ].filter(Boolean).length;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onChange(
      documentSearch.parse({ ...search, ...Object.fromEntries(form), page: 1 }),
    );
    setOpen(false);
  }
  return (
    <>
      <form
        className="document-inline-filters hidden items-center gap-2 @min-[80rem]/library:flex"
        key={JSON.stringify(search)}
        onSubmit={submit}
      >
        <FilterFields
          search={search}
          catalog={catalog}
          onSelect={(name, value) =>
            onChange(
              documentSearch.parse({ ...search, [name]: value, page: 1 }),
            )
          }
        />
        {count > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Reset filters"
            onClick={() =>
              onChange(documentSearch.parse({ q: search.q, sort: search.sort }))
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        )}
      </form>
      <div className="@min-[80rem]/library:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" />}>
            <HugeiconsIcon icon={FilterHorizontalIcon} />
            Filters
            {count > 0 && (
              <span className="rounded-sm bg-muted px-1 text-[10px]">
                {count}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-4">
            <PopoverTitle>Filter documents</PopoverTitle>
            <form
              className="flex flex-col gap-4"
              onSubmit={submit}
              key={JSON.stringify(search)}
            >
              <FilterFields search={search} catalog={catalog} />
              <div className="flex justify-between border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onChange(
                      documentSearch.parse({ q: search.q, sort: search.sort }),
                    );
                    setOpen(false);
                  }}
                >
                  Reset filters
                </Button>
                <Button type="submit">Apply filters</Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

function FilterFields({
  search,
  catalog,
  onSelect,
}: {
  search: Search;
  catalog: components["schemas"]["Catalog"];
  onSelect?: (
    name: "owner" | "tag" | "status" | "after" | "before",
    value: string,
  ) => void;
}) {
  return (
    <>
      <label className="field-label">
        <span>Owner</span>
        <SelectField
          label="Owner"
          name="owner"
          defaultValue={search.owner}
          onValueChange={(value) => onSelect?.("owner", value)}
          items={[
            { value: "", label: "All owners" },
            ...catalog.owners.map((entry) => ({
              value: entry.id,
              label: entry.name,
            })),
          ]}
        />
      </label>
      <label className="field-label">
        <span>Tag</span>
        <SelectField
          label="Tag"
          name="tag"
          defaultValue={search.tag}
          onValueChange={(value) => onSelect?.("tag", value)}
          items={[
            { value: "", label: "All tags" },
            ...catalog.tags.map((entry) => ({
              value: entry.id,
              label: entry.name,
            })),
          ]}
        />
      </label>
      <div className="filter-dates grid grid-cols-2 gap-3">
        <label className="field-label">
          <span>From</span>
          <DatePicker
            label="From"
            name="after"
            defaultValue={search.after}
            onValueChange={(value) => onSelect?.("after", value)}
          />
        </label>
        <label className="field-label">
          <span>Through</span>
          <DatePicker
            label="Through"
            name="before"
            defaultValue={search.before}
            onValueChange={(value) => onSelect?.("before", value)}
          />
        </label>
      </div>
      <label className="field-label">
        <span>Tagging</span>
        <SelectField
          label="Tagging"
          name="status"
          defaultValue={search.status}
          onValueChange={(value) => onSelect?.("status", value)}
          items={[
            { value: "", label: "Any status" },
            { value: "complete", label: "Complete" },
            { value: "pending", label: "Pending" },
            { value: "running", label: "Processing" },
            { value: "failed", label: "Failed" },
          ]}
        />
      </label>
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
      <DropdownMenuContent align="end">
        {documentSearch.shape.sort.unwrap().options.map((sort) => (
          <DropdownMenuItem key={sort} onClick={() => onChange(sort)}>
            <HugeiconsIcon icon={options[sort].icon} />
            {options[sort].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ActiveFilters({
  search,
  catalog,
  onChange,
}: {
  search: Search;
  catalog: components["schemas"]["Catalog"];
  onChange: (search: Search) => void;
}) {
  const filters = [
    {
      key: "owner",
      label:
        catalog.owners.find((entry) => entry.id === search.owner)?.name ??
        search.owner,
      clear: () => onChange({ ...search, owner: "", page: 1 }),
    },
    {
      key: "tag",
      label:
        catalog.tags.find((entry) => entry.id === search.tag)?.name ??
        search.tag,
      clear: () => onChange({ ...search, tag: "", page: 1 }),
    },
    {
      key: "after",
      label: search.after && `From ${search.after}`,
      clear: () => onChange({ ...search, after: "", page: 1 }),
    },
    {
      key: "before",
      label: search.before && `Through ${search.before}`,
      clear: () => onChange({ ...search, before: "", page: 1 }),
    },
    {
      key: "status",
      label: search.status && `Tagging: ${search.status}`,
      clear: () => onChange({ ...search, status: "", page: 1 }),
    },
  ].filter((filter) => filter.label);
  if (!filters.length) return null;
  return (
    <div className="flex basis-full flex-wrap items-center gap-2 pt-1">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant="secondary"
          size="sm"
          onClick={filter.clear}
          aria-label={`Remove ${filter.label} filter`}
        >
          {filter.label}
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      ))}
    </div>
  );
}
