import { useState } from "react";
import { useAccess } from "./auth/access-context";
import { canAdmin } from "@/lib/auth/access";
import type { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilterHorizontalIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
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
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const count = [
    search.owner.length,
    search.tag.length,
    search.after || search.before,
    search.status,
    search.delivery,
    search.inbox,
  ].filter(Boolean).length;
  function change(filter: Partial<Search>) {
    onChange({ ...search, ...filter, page: 1 });
  }
  function reset() {
    change({
      owner: [],
      tag: [],
      after: "",
      before: "",
      status: "",
      delivery: "",
      inbox: "",
    });
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
      {access.state === "authenticated" && canAdmin(access) && (
        <div className="w-full shrink-0 @min-[74rem]/library:w-32">
          <SelectField
            label="Delivery status"
            value={search.delivery}
            items={[
              { value: "", label: "Any delivery" },
              { value: "review", label: "Needs delivery" },
              { value: "delivered", label: "Delivered" },
            ]}
            onValueChange={(value) =>
              change({ delivery: documentSearch.shape.delivery.parse(value) })
            }
          />
        </div>
      )}
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
