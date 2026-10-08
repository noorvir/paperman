import { useState, type ComponentProps } from "react";
import { useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { getDocumentTags, getTagIcon } from "@/lib/catalog-icons";
import type { components } from "@/lib/schema";
import { saveDocumentTags, saveEntry } from "@/lib/actions";
import { ActionButton } from "./page";
import { TagLink } from "./tag-link";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function DocumentTags({
  document,
  catalog,
  allowActions,
  search,
}: {
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
  allowActions: boolean;
  search: ComponentProps<typeof TagLink>["search"];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    id: string;
    action: "add" | "remove";
  } | null>(null);
  const [error, setError] = useState("");
  const tags = getDocumentTags(document, catalog);
  const availableTags = catalog.tags.filter(
    (tag) => !tags.some((selected) => selected.id === tag.id),
  );

  async function updateTag(id: string, action: "add" | "remove") {
    if (pending) {
      return;
    }
    setPending({ id, action });
    setError("");
    try {
      await saveDocumentTags({
        data: {
          id: document.id,
          tag_ids:
            action === "add"
              ? [...tags.map((tag) => tag.id), id]
              : tags.filter((tag) => tag.id !== id).map((tag) => tag.id),
        },
      });
      await router.invalidate({ sync: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save tags");
    } finally {
      setPending(null);
    }
  }

  const knownNames = new Set(
    catalog.tags.map((tag) => formatTagName(tag.name).toLowerCase()),
  );
  const suggestions: string[] = [];
  for (const value of document.suggested_tags) {
    const name = formatTagName(value);
    const key = name.toLowerCase();
    if (!name || knownNames.has(key)) {
      continue;
    }
    knownNames.add(key);
    suggestions.push(name);
  }
  return (
    <>
      <section className="workspace-section border-y py-4">
        <h2 className="workspace-title">Tags</h2>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-md bg-muted"
            >
              <TagLink tag={tag} search={search} className="px-2" />
              {allowActions && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 rounded-l-none text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${tag.name}`}
                  loading={
                    pending?.action === "remove" && pending.id === tag.id
                  }
                  icon={
                    <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
                  }
                  disabled={Boolean(pending)}
                  onClick={() => void updateTag(tag.id, "remove")}
                />
              )}
            </span>
          ))}
          {allowActions && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="rounded-full"
                    loading={pending?.action === "add"}
                    icon={<HugeiconsIcon icon={Add01Icon} aria-hidden="true" />}
                  />
                }
                aria-label="Add tag"
                disabled={Boolean(pending) || availableTags.length === 0}
              />
              <DropdownMenuContent className="w-48" aria-label="Available tags">
                {availableTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={() => void updateTag(tag.id, "add")}
                  >
                    <HugeiconsIcon icon={getTagIcon(tag)} aria-hidden="true" />
                    {tag.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!allowActions && tags.length === 0 && (
            <p className="workspace-description">No tags assigned.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </section>
      {allowActions && suggestions.length > 0 && (
        <section className="workspace-section">
          <h3 className="text-xs font-medium">Suggested tags</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <ActionButton
                key={name}
                variant="secondary"
                size="sm"
                className="max-w-full gap-1.5 rounded-full px-2 font-normal"
                aria-label={`Add ${name} to catalog`}
                title={`Add ${name} to catalog`}
                icon={<HugeiconsIcon icon={Add01Icon} aria-hidden="true" />}
                action={() =>
                  saveEntry({
                    data: {
                      kind: "tags",
                      id: "",
                      value: { name, aliases: [] },
                    },
                  })
                }
              >
                <span className="truncate">{name}</span>
              </ActionButton>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function formatTagName(value: string) {
  const name = value.replace(/_/g, " ").trim().replace(/\s+/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
