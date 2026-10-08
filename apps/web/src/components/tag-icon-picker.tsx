import { HugeiconsIcon } from "@hugeicons/react";
import { catalogIcons, catalogIconInput } from "@/lib/catalog-icons";
import type { components } from "@/lib/schema";

export function TagIconPicker({
  value,
  onChange,
}: {
  value: components["schemas"]["CatalogEntry"]["icon"];
  onChange: (value: components["schemas"]["CatalogEntry"]["icon"]) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-medium">Icon</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {Object.entries(catalogIcons).map(([key, option]) => (
          <label
            key={key}
            className="relative flex cursor-pointer flex-col items-center gap-2 rounded-md border border-input px-2 py-3 text-xs hover:bg-accent has-checked:border-ring has-checked:bg-accent/50 has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              className="sr-only"
              type="radio"
              name="icon"
              value={key}
              checked={value === key}
              onChange={() => onChange(catalogIconInput.parse(key))}
            />
            <HugeiconsIcon icon={option.icon} size={20} aria-hidden="true" />
            {option.label}
          </label>
        ))}
      </div>
      <p className="workspace-description">
        Automatic uses the standard icon for built-in tags. Other tags use the
        document icon.
      </p>
    </fieldset>
  );
}
