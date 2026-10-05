import { HugeiconsIcon } from "@hugeicons/react";
import { ListViewIcon, GridViewIcon } from "@hugeicons/core-free-icons";
import { Button } from "./ui/button";

export function DocumentLayoutToggle({
  value,
  onChange,
}: {
  value: "list" | "grid";
  onChange: (value: "list" | "grid") => void;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-full border p-0.5"
      role="group"
      aria-label="File layout"
    >
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full aria-pressed:bg-muted"
        aria-label="List view"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <HugeiconsIcon icon={ListViewIcon} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full aria-pressed:bg-muted"
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
      >
        <HugeiconsIcon icon={GridViewIcon} />
      </Button>
    </div>
  );
}
