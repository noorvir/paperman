import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

export function MultiSelectFilter({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string; icon?: ReactNode }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  let selection = label;
  const first = value[0];
  if (value.length === 1 && first) {
    selection = items.find((item) => item.value === first)?.label ?? first;
  } else if (value.length > 1) {
    selection = `${label} (${value.length})`;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${value.length ? selection : "All"}`}
        render={
          <Button
            variant="outline"
            className="w-full min-w-0 justify-between font-normal data-[active=true]:bg-muted"
            data-active={value.length > 0}
          />
        }
      >
        <span className="truncate">{selection}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label} · Match any selected</DropdownMenuLabel>
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={value.includes(item.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, item.value]
                    : value.filter((entry) => entry !== item.value),
                )
              }
            >
              {item.icon}
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!value.length} onClick={() => onChange([])}>
          <HugeiconsIcon icon={Cancel01Icon} />
          Clear {label.toLowerCase()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
