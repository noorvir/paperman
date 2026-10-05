import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { approveScan } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { Input } from "./ui/input";
import { Button, buttonVariants } from "./ui/button";
import { SelectField } from "./select-field";
import { DatePicker } from "./date-picker";

type Proposal = NonNullable<components["schemas"]["Scan"]["proposal"]>;
type Draft = {
  pages: string;
  owner_id: string;
  title: string;
  document_date: string;
  review_reason: string;
};
export function ReviewForm({
  scan,
  proposal,
  owners,
  documentRevisions,
}: {
  scan: components["schemas"]["Scan"];
  proposal: Proposal;
  owners: components["schemas"]["CatalogEntry"][];
  documentRevisions: Record<string, number>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(
    proposal.documents.map((document) => ({
      ...document,
      pages: document.pages.join(", "),
      document_date: document.document_date ?? "",
      review_reason: document.review_reason ?? "",
    })),
  );
  const [pending, setPending] = useState(false);
  const [blankPages, setBlankPages] = useState(proposal.blank_pages.join(", "));
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const router = useRouter();
  const [revisions] = useState(documentRevisions);
  function update(index: number, patch: Partial<Draft>) {
    setDrafts((drafts) =>
      drafts.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const documents = drafts.map((draft) => ({
        ...draft,
        pages: draft.pages.split(",").map((page) => Number(page.trim())),
        document_date: draft.document_date || null,
        confidence: 1,
        review_reason: "",
      }));
      let blankPageNumbers: number[] = [];
      if (blankPages.trim()) {
        blankPageNumbers = blankPages
          .split(",")
          .map((page) => Number(page.trim()));
      }
      await approveScan({
        data: {
          id: scan.id,
          proposal: {
            documents,
            blank_pages: blankPageNumbers,
            document_revisions: revisions,
          },
        },
      });
      await router.invalidate();
      await navigate({ to: "/scans/$scanId", params: { scanId: scan.id } });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not approve this scan",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="workspace-section"
      onSubmit={(event) => void submit(event)}
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        Account for pages 1 through {scan.page_count}, once each, in a document
        group or as a blank page. Keep document pages in source order. A blank
        date uses the scan date.
      </p>
      <label className="field-label">
        Blank pages to omit
        <Input
          value={blankPages}
          disabled={pending}
          placeholder="For example: 2, 4, 6"
          onChange={(event) => setBlankPages(event.target.value)}
        />
        <span className="text-xs font-normal leading-relaxed text-muted-foreground">
          Check these pages in the preview. They stay in the original scan. To
          restore a page, remove its number here and add it to a document group.
        </span>
      </label>
      {drafts.length === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No documents will be filed. Confirm that every source page is blank,
          or add a document group to keep content.
        </p>
      )}
      {scan.status === "complete" && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Changed groups get new documents and new tags. Their old files,
          summaries, and text corrections stay in scan history. Unchanged groups
          keep their saved information.
        </p>
      )}
      <div>
        {drafts.map((draft, index) => (
          <fieldset
            key={index}
            disabled={pending}
            className="grid gap-3 border-t py-4"
          >
            <legend className="sr-only">Document {index + 1}</legend>
            <div className="flex items-center justify-between">
              <h2 className="workspace-title">Document {index + 1}</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  setDrafts((drafts) =>
                    drafts.filter((_draft, position) => position !== index),
                  )
                }
              >
                Remove group
              </Button>
            </div>
            {draft.review_reason && (
              <p className="text-xs text-muted-foreground">
                {draft.review_reason}
              </p>
            )}
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
              <label className="field-label">
                Pages
                <Input
                  required
                  aria-label={`Document ${index + 1} pages`}
                  value={draft.pages}
                  onChange={(event) =>
                    update(index, { pages: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Title
                <Input
                  required
                  maxLength={120}
                  aria-label={`Document ${index + 1} title`}
                  value={draft.title}
                  onChange={(event) =>
                    update(index, { title: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="field-label">
                Owner
                <SelectField
                  label={`Document ${index + 1} owner`}
                  value={draft.owner_id}
                  onValueChange={(value) => update(index, { owner_id: value })}
                  items={owners.map((owner) => ({
                    value: owner.id,
                    label: owner.name,
                  }))}
                />
              </label>
              <label className="field-label">
                Document date
                <DatePicker
                  label={`Document ${index + 1} date`}
                  value={draft.document_date}
                  onValueChange={(value) =>
                    update(index, { document_date: value })
                  }
                />
              </label>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            setDrafts((drafts) => [
              ...drafts,
              {
                pages: "",
                title: "",
                owner_id: "unknown",
                document_date: "",
                review_reason: "",
              },
            ])
          }
        >
          Add document group
        </Button>
        <div className="flex gap-2">
          <Link
            to="/scans/$scanId"
            params={{ scanId: scan.id }}
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving"
              : scan.status === "complete"
                ? "Save page groups"
                : "Approve and file"}
          </Button>
        </div>
      </div>
      <ErrorNotice message={error} />
    </form>
  );
}
