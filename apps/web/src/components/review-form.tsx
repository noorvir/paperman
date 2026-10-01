import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { approveScan } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { SelectField } from "./select-field";
import { DatePicker } from "./date-picker";

type Proposal = components["schemas"]["Analysis-Output"];
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
}: {
  scan: components["schemas"]["Scan"];
  proposal: Proposal;
  owners: components["schemas"]["CatalogEntry"][];
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
  const [error, setError] = useState("");
  const navigate = useNavigate();
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
      await approveScan({ data: { id: scan.id, proposal: { documents } } });
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
        Account for pages 1 through {scan.page_count}, once each and in order.
        Keep blank backs with their document. A blank date uses the scan date.
      </p>
      <div>
        {drafts.map((draft, index) => (
          <fieldset key={index} className="grid gap-3 border-t py-4">
            <legend className="sr-only">Document {index + 1}</legend>
            <div className="flex items-center justify-between">
              <h2 className="workspace-title">Document {index + 1}</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={drafts.length === 1}
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Approve and file"}
        </Button>
      </div>
      <ErrorNotice message={error} />
    </form>
  );
}
