import type { components } from "@/lib/schema";
import { Checkbox } from "./ui/checkbox";

export function OwnerSelection({
  owners,
  value,
  onChange,
}: {
  owners: components["schemas"]["CatalogEntry"][];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-medium">Owners</legend>
      <p className="text-xs text-muted-foreground">
        Select all recipients. A copy is kept in each owner's folder.
      </p>
      {owners.map((owner) => (
        <label key={owner.id} className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={value.includes(owner.id)}
            onCheckedChange={(checked) => {
              if (checked && owner.id === "unknown") {
                onChange(["unknown"]);
                return;
              }
              const selected = value.filter(
                (id) => id !== "unknown" && id !== owner.id,
              );
              if (checked) {
                selected.push(owner.id);
              }
              onChange(selected.length ? selected.sort() : ["unknown"]);
            }}
          />
          {owner.name}
        </label>
      ))}
    </fieldset>
  );
}
