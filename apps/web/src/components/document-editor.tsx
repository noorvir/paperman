import { useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { editDocument } from "@/lib/actions";
import { getTagIcon } from "@/lib/catalog-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ErrorNotice } from "./page";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button, buttonVariants } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { SelectField } from "./select-field";
import { DatePicker } from "./date-picker";

export function DocumentEditor({
  document,
  text,
  catalog,
  onDone,
}: {
  document: components["schemas"]["Document"];
  text: string;
  catalog: components["schemas"]["Catalog"];
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    revision: document.revision,
    title: document.title,
    owner_id: document.owner_id,
    document_date:
      document.date_source === "document" ? document.document_date : "",
    summary: document.summary,
    text,
    tag_ids: [
      ...new Set([
        ...document.user_tags,
        ...document.generated_tags.filter(
          (id) => !document.excluded_tags.includes(id),
        ),
      ]),
    ],
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await editDocument({
        data: {
          id: document.id,
          value: { ...draft, document_date: draft.document_date || null },
        },
      });
      await router.invalidate();
      onDone();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save this document",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => void submit(event)}
      aria-label="Edit document"
    >
      <fieldset
        disabled={pending}
        className="min-h-0 flex-1 space-y-4 overflow-auto p-3"
      >
        <legend className="sr-only">Document information</legend>
        <div className="space-y-2">
          <Link
            to="/scans/$scanId/review"
            params={{ scanId: document.scan_id }}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit page groups
          </Link>
          <p className="text-xs text-muted-foreground">
            Split or merge documents from the original scan. Save this draft
            before leaving.
          </p>
        </div>
        <label className="field-label">
          Title
          <Input
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
          />
        </label>
        <label className="field-label">
          Owner
          <SelectField
            label="Owner"
            value={draft.owner_id}
            items={catalog.owners.map((owner) => ({
              value: owner.id,
              label: owner.name,
            }))}
            onValueChange={(owner_id) => setDraft({ ...draft, owner_id })}
          />
        </label>
        <div className="field-label">
          Issue date
          <DatePicker
            label="Issue date"
            value={draft.document_date}
            onValueChange={(document_date) =>
              setDraft({ ...draft, document_date })
            }
          />
          <p className="text-xs font-normal text-muted-foreground">
            Leave blank to use the scan date.
          </p>
        </div>
        <label className="field-label">
          Summary
          <Textarea
            rows={4}
            maxLength={10000}
            value={draft.summary}
            onChange={(event) =>
              setDraft({ ...draft, summary: event.target.value })
            }
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium">Tags</legend>
          <div className="grid grid-cols-2 gap-2">
            {catalog.tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-xs">
                <Checkbox
                  disabled={pending}
                  checked={draft.tag_ids.includes(tag.id)}
                  onCheckedChange={(checked) =>
                    setDraft({
                      ...draft,
                      tag_ids: checked
                        ? [...draft.tag_ids, tag.id]
                        : draft.tag_ids.filter((id) => id !== tag.id),
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
        <label className="field-label">
          Extracted text
          <Textarea
            rows={10}
            value={draft.text}
            maxLength={1000000}
            onChange={(event) =>
              setDraft({ ...draft, text: event.target.value })
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            Corrections update search and future tagging. The PDF and original
            scan stay unchanged.
          </span>
        </label>
      </fieldset>
      <div className="shrink-0 space-y-2 border-t p-3">
        <ErrorNotice message={error} />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onDone}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
