import { HugeiconsIcon } from "@hugeicons/react";
import { getTagIcon } from "@/lib/catalog-icons";
import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { saveDocumentTags, saveEntry } from "@/lib/actions";
import { ErrorNotice, ActionButton } from "./page";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

export function DocumentTags({
  document,
  catalog,
}: {
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
}) {
  const generated = document.generated_tags.filter(
    (id) => !document.excluded_tags.includes(id),
  );
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const selected = draft ?? new Set([...generated, ...document.user_tags]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await saveDocumentTags({
        data: { id: document.id, tags: [...selected] },
      });
      await router.invalidate();
      setDraft(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save tags");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form
        className="workspace-section border-y py-4"
        onSubmit={(event) => void submit(event)}
      >
        <h2 className="workspace-title">Tags</h2>
        {catalog.tags?.map((tag) => (
          <label key={tag.id} className="flex items-center gap-2 text-xs">
            <Checkbox
              disabled={pending}
              checked={selected.has(tag.id)}
              onCheckedChange={(checked) =>
                setDraft(() => {
                  const next = new Set(selected);
                  if (checked) {
                    next.add(tag.id);
                  } else {
                    next.delete(tag.id);
                  }
                  return next;
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
        <ErrorNotice message={error} />
        <Button type="submit" disabled={pending || draft === null}>
          {pending ? "Saving" : "Save tags"}
        </Button>
      </form>
      {(document.suggested_tags ?? [])
        .filter(
          (name) =>
            !catalog.tags?.some(
              (tag) => tag.name.toLowerCase() === name.toLowerCase(),
            ),
        )
        .map((name) => (
          <div key={name} className="workspace-section">
            <p className="text-xs text-muted-foreground">
              Suggested tag: {name}
            </p>
            <ActionButton
              action={() =>
                saveEntry({
                  data: { kind: "tags", id: "", value: { name, aliases: [] } },
                })
              }
            >
              Add to catalog
            </ActionButton>
          </div>
        ))}
    </>
  );
}
