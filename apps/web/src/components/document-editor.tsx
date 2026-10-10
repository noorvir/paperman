import { useEffect, useState, type FormEvent } from "react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { Tabs } from "@base-ui/react/tabs";
import type { components } from "@/lib/schema";
import { editDocument } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { DocumentEditorDetails } from "./document-editor-details";

export function DocumentEditor({
  document,
  canChangeOwners,
  text,
  catalog,
  rotations,
  pages,
  onSaving,
  onDone,
}: {
  document: components["schemas"]["Document"];
  text: string;
  canChangeOwners: boolean;
  catalog: components["schemas"]["Catalog"];
  onDone: () => void;
  rotations: number[];
  pages: number[];
  onSaving: (saving: boolean) => void;
}) {
  const [draft, setDraft] = useState<components["schemas"]["DocumentEdit"]>(
    () => ({
      revision: document.revision,
      title: document.title,
      owner_ids: document.owner_ids,
      creator_ids: document.creator_ids,
      document_date:
        document.date_source === "document" ? document.document_date : null,
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
    }),
  );
  const route = getRouteApi("/documents/$documentId");
  const { editorTab: tab = "details" } = route.useSearch();
  const navigate = route.useNavigate();
  const setTab = (editorTab: "details" | "summary" | "text") =>
    void navigate({
      search: (previous) => ({ ...previous, editorTab }),
      replace: true,
      resetScroll: false,
    });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const unsaved = useUnsavedChanges(
    JSON.stringify({
      ...draft,
      pages,
      rotations: pages.map((page) => rotations[page - 1]),
      owner_ids: [...draft.owner_ids].sort(),
      tag_ids: [...draft.tag_ids].sort(),
    }),
    ["editorTab", "zoom"],
  );

  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !pending) {
        event.preventDefault();
        onDone();
      }
    }
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [onDone, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setTab("details");
      setError("Enter a document title.");
      return;
    }
    if (pages.length === 0) {
      setError("Select at least one page.");
      return;
    }
    setPending(true);
    onSaving(true);
    setError("");
    try {
      const corrections: components["schemas"]["PageRotation"][] = [];
      pages.forEach((page, index) => {
        const clockwise = rotations[page - 1];
        if (clockwise === 90 || clockwise === 180 || clockwise === 270) {
          corrections.push({ page: index + 1, clockwise });
        }
      });
      await editDocument({
        data: {
          id: document.id,
          value: { ...draft, source_pages: pages, rotations: corrections },
        },
      });
      unsaved.markSaved();
      await router.invalidate({ sync: true });
      onDone();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save this document",
      );
    } finally {
      setPending(false);
      onSaving(false);
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => void submit(event)}
      aria-label="Edit document"
      noValidate
    >
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          if (value === "details" || value === "summary" || value === "text") {
            setTab(value);
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <Tabs.List className="view-tabs" aria-label="Edit document sections">
          <Tabs.Tab value="details">Details</Tabs.Tab>
          <Tabs.Tab value="summary">Summary</Tabs.Tab>
          <Tabs.Tab value="text">Text</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="details" keepMounted className="editor-panel">
          <DocumentEditorDetails
            canChangeOwners={canChangeOwners}
            catalog={catalog}
            value={draft}
            onChange={setDraft}
            disabled={pending}
          />
        </Tabs.Panel>
        <Tabs.Panel value="summary" keepMounted className="editor-panel">
          <label className="field-label min-h-0 flex-1">
            Summary
            <Textarea
              className="min-h-0 flex-1 resize-none font-normal text-sm leading-relaxed"
              maxLength={10000}
              value={draft.summary}
              disabled={pending}
              onChange={(event) =>
                setDraft({ ...draft, summary: event.target.value })
              }
            />
          </label>
        </Tabs.Panel>
        <Tabs.Panel value="text" keepMounted className="editor-panel">
          <label className="field-label min-h-0 flex-1">
            Extracted text
            <Textarea
              className="min-h-0 flex-1 resize-none font-mono font-normal text-sm leading-relaxed"
              value={draft.text}
              maxLength={1000000}
              disabled={pending}
              onChange={(event) =>
                setDraft({ ...draft, text: event.target.value })
              }
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Corrections update search and future tagging. The PDF stays
            unchanged. Changing pages refreshes extracted text unless you edit
            it here.
          </p>
        </Tabs.Panel>
      </Tabs.Root>
      <div className="mt-4 shrink-0 space-y-2 border-t pt-3">
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
          <Button
            type="submit"
            disabled={pending || !unsaved.isDirty || pages.length === 0}
            loading={pending}
          >
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
