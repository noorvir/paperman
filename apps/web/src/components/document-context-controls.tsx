import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { Toggle } from "./ui/toggle";

export function DocumentContextControls({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="text-xs" role="group" aria-label="PDF view options">
      <Toggle
        variant="outline"
        className="w-full"
        pressed={checked}
        onPressedChange={onChange}
      >
        <HugeiconsIcon
          icon={Layers01Icon}
          className={`size-3.5 ${checked ? "[&_path:first-child]:fill-current" : ""}`}
          aria-hidden="true"
        />
        View in context
      </Toggle>
    </div>
  );
}
