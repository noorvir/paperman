import type { components } from "@/lib/schema";
import { getTagIcon } from "@/lib/catalog-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { OwnerSelection } from "./owner-selection";
import { DatePicker } from "./date-picker";

export function DocumentEditorDetails({
  catalog,
  value,
  onChange,
  disabled,
}: {
  catalog: components["schemas"]["Catalog"];
  value: components["schemas"]["DocumentEdit"];
  onChange: (value: components["schemas"]["DocumentEdit"]) => void;
  disabled: boolean;
}) {
  return (
    <>
      <fieldset
        disabled={disabled}
        className="min-h-0 flex-1 space-y-5 overflow-auto pr-2 pb-3"
      >
        <legend className="sr-only">Document details</legend>
        <label className="field-label">
          Title
          <Input
            required
            maxLength={120}
            value={value.title}
            onChange={(event) =>
              onChange({ ...value, title: event.target.value })
            }
          />
        </label>
        <OwnerSelection
          owners={catalog.owners}
          value={value.owner_ids}
          onChange={(owner_ids) => onChange({ ...value, owner_ids })}
        />
        <div className="field-label">
          Issue date
          <DatePicker
            label="Issue date"
            value={value.document_date ?? ""}
            onValueChange={(document_date) =>
              onChange({ ...value, document_date: document_date || null })
            }
          />
          <p className="text-xs font-normal text-muted-foreground">
            Leave blank to use the scan date.
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium">Tags</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
            {catalog.tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-xs">
                <Checkbox
                  disabled={disabled}
                  checked={value.tag_ids.includes(tag.id)}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      tag_ids: checked
                        ? [...value.tag_ids, tag.id]
                        : value.tag_ids.filter((id) => id !== tag.id),
                    })
                  }
                />
                <HugeiconsIcon
                  icon={getTagIcon(tag)}
                  size={14}
                  aria-hidden="true"
                />
                {tag.name}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>
    </>
  );
}
