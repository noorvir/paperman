import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "./ui/popover";

export function DateRangeFilter({
  after,
  before,
  onChange,
}: {
  after: string;
  before: string;
  onChange: (value: { after: string; before: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>();
  const label = rangeLabel(after, before);
  return (
    <Popover
      open={open}
      onOpenChange={(open) => {
        if (open) {
          setDraft({
            from: after ? parseISO(after) : undefined,
            to: before ? parseISO(before) : undefined,
          });
        }
        setOpen(open);
      }}
    >
      <PopoverTrigger
        aria-label={`Date: ${label}`}
        render={
          <Button
            variant="outline"
            className="w-full justify-start font-normal @min-[74rem]/library:w-auto data-[active=true]:bg-muted"
            data-active={Boolean(after || before)}
          />
        }
      >
        <HugeiconsIcon
          icon={Calendar03Icon}
          className="text-muted-foreground"
        />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <div className="px-3 pt-3">
          <PopoverTitle>Date range</PopoverTitle>
          <p className="mt-1 text-muted-foreground">
            Select a start and end date.
          </p>
        </div>
        <Calendar
          mode="range"
          selected={draft}
          defaultMonth={draft?.from ?? draft?.to}
          onSelect={setDraft}
          weekStartsOn={1}
          autoFocus
          className="[--cell-size:--spacing(8)]"
        />
        <div className="flex items-center justify-between gap-4 border-t p-2">
          <Button
            variant="ghost"
            onClick={() => {
              onChange({ after: "", before: "" });
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft?.from}
              onClick={() => {
                if (!draft?.from) {
                  return;
                }
                onChange({
                  after: format(draft.from, "yyyy-MM-dd"),
                  before: format(draft.to ?? draft.from, "yyyy-MM-dd"),
                });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function rangeLabel(after: string, before: string) {
  if (!after && !before) {
    return "Date";
  }
  if (!after) {
    return `Until ${format(parseISO(before), "d MMM yyyy")}`;
  }
  const from = parseISO(after);
  if (!before) {
    return `Since ${format(from, "d MMM yyyy")}`;
  }
  const to = parseISO(before);
  if (after === before) {
    return format(from, "d MMM yyyy");
  }
  let startFormat = "d MMM yyyy";
  if (from.getFullYear() === to.getFullYear()) {
    startFormat = from.getMonth() === to.getMonth() ? "d" : "d MMM";
  }
  return `${format(from, startFormat)}–${format(to, "d MMM yyyy")}`;
}
