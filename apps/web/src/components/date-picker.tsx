import { useState } from "react";
import { format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function DatePicker({
  label,
  name,
  value,
  defaultValue = "",
  onValueChange,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(defaultValue);
  const current = value ?? draft;
  const selected = current ? parseISO(current) : undefined;
  function select(date: Date | undefined) {
    const next = date ? format(date, "yyyy-MM-dd") : "";
    setDraft(next);
    onValueChange?.(next);
    setOpen(false);
  }
  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={label}
          render={
            <Button
              variant="outline"
              className="w-full min-w-0 shrink justify-between bg-input/20 font-normal"
            />
          }
        >
          <span className={current ? "" : "text-muted-foreground"}>
            {selected ? format(selected, "dd.MM.yyyy") : "dd.mm.yyyy"}
          </span>
          <HugeiconsIcon
            icon={Calendar03Icon}
            className="text-muted-foreground"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto gap-0 p-0"
          aria-label={label}
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={select}
            weekStartsOn={1}
            autoFocus
          />
          <div className="flex justify-between gap-2 border-t p-2">
            <Button variant="ghost" onClick={() => select(undefined)}>
              Clear
            </Button>
            <Button variant="ghost" onClick={() => select(new Date())}>
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
