import { useState, type FormEvent } from "react";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterHorizontalIcon,
  ArrowDown01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { documentSearch } from "@/lib/queries";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <HugeiconsIcon icon={FilterHorizontalIcon} />
        Filters
        {count > 0 && (
          <span className="rounded-sm bg-muted px-1 text-[10px]">{count}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4">
        <PopoverTitle>Filter documents</PopoverTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={submit}
          key={JSON.stringify(search)}
        >
          <label className="field-label">
            Owner
            <NativeSelect
              name="owner"
              defaultValue={search.owner}
              className="w-full"
            >
              <NativeSelectOption value="">All owners</NativeSelectOption>
              {catalog.owners.map((entry) => (
                <NativeSelectOption key={entry.id} value={entry.id}>
                  {entry.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="field-label">
            Tag
            <NativeSelect
              name="tag"
              defaultValue={search.tag}
              className="w-full"
            >
              <NativeSelectOption value="">All tags</NativeSelectOption>
              {catalog.tags.map((entry) => (
                <NativeSelectOption key={entry.id} value={entry.id}>
                  {entry.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field-label">
              From
              <Input type="date" name="after" defaultValue={search.after} />
            </label>
            <label className="field-label">
              Through
              <Input type="date" name="before" defaultValue={search.before} />
            </label>
          </div>
          <label className="field-label">
            Tagging
            <NativeSelect
              name="status"
              defaultValue={search.status}
              className="w-full"
            >
              <NativeSelectOption value="">Any status</NativeSelectOption>
              <NativeSelectOption value="complete">Complete</NativeSelectOption>
              <NativeSelectOption value="pending">Pending</NativeSelectOption>
              <NativeSelectOption value="running">
                Processing
              </NativeSelectOption>
              <NativeSelectOption value="failed">Failed</NativeSelectOption>
            </NativeSelect>
          </label>
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
  );
}

export function DocumentSort({
  value,
  onChange,
}: {
  value: Search["sort"];
  onChange: (sort: Search["sort"]) => void;
}) {
  const labels = {
    date_desc: "Newest first",
    date_asc: "Oldest first",
    title: "Title A–Z",
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" />}
        aria-label="Sort documents"
      >
        {labels[value]}
        <HugeiconsIcon icon={ArrowDown01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {documentSearch.shape.sort.unwrap().options.map((sort) => (
          <DropdownMenuItem key={sort} onClick={() => onChange(sort)}>
            {labels[sort]}
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
