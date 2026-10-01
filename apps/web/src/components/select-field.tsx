import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function SelectField({
  label,
  items,
  className,
  onValueChange,
  ...props
}: {
  label: string;
  items: { value: string; label: string }[];
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <Select
      {...props}
      items={items}
      onValueChange={(value) => {
        if (value !== null) {
          onValueChange?.(value);
        }
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("w-full min-w-0", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className="w-max min-w-(--anchor-width) max-w-(--available-width)"
      >
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
