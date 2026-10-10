import type { components } from "@/lib/schema";
import { getTagIcon } from "@/lib/catalog-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { OwnerSelection } from "./owner-selection";
import { getDirectory } from "@/lib/directory";
import { DatePicker } from "./date-picker";

export function DocumentEditorDetails({
  catalog,
  value,
  onChange,
  disabled,
  canChangeOwners,
}: {
  catalog: components["schemas"]["Catalog"];
  value: components["schemas"]["DocumentEdit"];
  onChange: (value: components["schemas"]["DocumentEdit"]) => void;
  disabled: boolean;
  canChangeOwners: boolean;
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
        {canChangeOwners && (
          <OwnerSelection
            owners={catalog.owners}
            value={value.owner_ids}
            onChange={(owner_ids) => onChange({ ...value, owner_ids })}
          />
        )}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium">Creator</legend>
          <p className="text-xs text-muted-foreground">
            People or organizations that produced this document. Leave empty
            when this does not apply.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
            {getDirectory(catalog).map((entry) => (
              <label key={entry.id} className="flex items-center gap-2 text-xs">
                <Checkbox
                  disabled={disabled}
                  checked={(value.creator_ids ?? []).includes(entry.id)}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      creator_ids: checked
                        ? [...(value.creator_ids ?? []), entry.id]
                        : (value.creator_ids ?? []).filter(
                            (id) => id !== entry.id,
                          ),
                    })
                  }
                />
                {entry.name}
              </label>
            ))}
          </div>
        </fieldset>
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
