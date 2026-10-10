import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { approveScan, reviseScan } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { Input } from "./ui/input";
import { Button, buttonVariants } from "./ui/button";
import { OwnerSelection } from "./owner-selection";
import { DatePicker } from "./date-picker";
import { CreatorProposalEditor } from "./creator-proposal-editor";
import { ReviewFeedback } from "./review-feedback";

type Proposal = NonNullable<components["schemas"]["Scan"]["proposal"]>;
type Draft = {
  pages: string;
  owner_ids: string[];
  creators: Proposal["documents"][number]["creators"];
  title: string;
  document_date: string;
  review_reason: string;
  confidence: number;
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
  const [drafts, setDrafts] = useState<Draft[]>(toDrafts(proposal));
  const [pending, setPending] = useState(false);
  const [blankPages, setBlankPages] = useState(proposal.blank_pages.join(", "));
  const [rotations, setRotations] = useState(proposal.page_rotations);
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const unsaved = useUnsavedChanges(
    JSON.stringify({ drafts, blankPages, rotations, instructions }),
    ["zoom"],
  );
  const [previous, setPrevious] = useState<{
    drafts: Draft[];
    blankPages: string;
    rotations: Proposal["page_rotations"];
  } | null>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const [revisions] = useState(documentRevisions);
  function update(index: number, patch: Partial<Draft>) {
    setPrevious(null);
    setDrafts((drafts) =>
      drafts.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }
  function getProposal() {
    return {
      page_rotations: rotations,
      documents: drafts.map((draft) => ({
        ...draft,
        pages: draft.pages.split(",").map((page) => Number(page.trim())),
        document_date: draft.document_date || null,
      })),
      blank_pages: blankPages.trim()
        ? blankPages.split(",").map((page) => Number(page.trim()))
        : [],
    };
  }
  async function revise(instructions: string) {
    setPending(true);
    setError("");
    try {
      const result = await reviseScan({
        data: { id: scan.id, proposal: getProposal(), instructions },
      });
      setPrevious({ drafts, blankPages, rotations });
      setRotations(result.page_rotations);
      setDrafts(toDrafts(result));
      setBlankPages(result.blank_pages.join(", "));
    } finally {
      setPending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError("");
    try {
      const current = getProposal();
      const documents = current.documents.map((document) => ({
        ...document,
        confidence: 1,
        review_reason: "",
      }));
      await approveScan({
        data: {
          id: scan.id,
          proposal: {
            documents,
            blank_pages: current.blank_pages,
            page_rotations: current.page_rotations,
            document_revisions: revisions,
          },
        },
      });
      unsaved.markSaved();
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
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Account for pages 1 through {scan.page_count}, once each, in a document
        group or as a blank page. Keep document pages in source order. A blank
        date uses the scan date. Check the fields marked in amber.
      </p>
      <ReviewFeedback
        instructions={instructions}
        onInstructionsChange={setInstructions}
        disabled={pending}
        onRevise={revise}
        onUndo={
          previous
            ? () => {
                setDrafts(previous.drafts);
                setBlankPages(previous.blankPages);
                setRotations(previous.rotations);
                setPrevious(null);
              }
            : undefined
        }
      />
      <label className="field-label">
        Blank pages to omit
        <Input
          value={blankPages}
          disabled={pending}
          placeholder="For example: 2, 4, 6"
          onChange={(event) => {
            setPrevious(null);
            setBlankPages(event.target.value);
          }}
        />
        <span className="text-xs font-normal leading-relaxed text-muted-foreground">
          Check these pages in the preview. They stay in the original scan. To
          restore a page, remove its number here and add it to a document group.
        </span>
      </label>
      {rotations.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Page corrections:{" "}
          {rotations
            .map(
              ({ page, clockwise }) => `page ${page}: ${clockwise}° clockwise`,
            )
            .join(", ")}
          . These are applied when filing. The source preview is unchanged.
        </p>
      )}
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
                onClick={() => {
                  setPrevious(null);
                  setDrafts((drafts) =>
                    drafts.filter((_draft, position) => position !== index),
                  );
                }}
              >
                Remove group
              </Button>
            </div>
            {draft.review_reason && (
              <p className="text-xs text-attention-foreground">
                {draft.review_reason}
              </p>
            )}
            {!draft.review_reason && draft.confidence < 0.9 && (
              <p className="text-xs text-attention-foreground">
                The model has low confidence in this document. Check its pages
                and details.
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
            <CreatorProposalEditor
              value={draft.creators}
              onChange={(creators) => update(index, { creators })}
            />
            <div className="grid grid-cols-2 gap-3">
              <OwnerSelection
                owners={owners}
                value={draft.owner_ids}
                onChange={(owner_ids) => update(index, { owner_ids })}
              />
              <label className="field-label">
                Document date
                <DatePicker
                  label={`Document ${index + 1} date`}
                  value={draft.document_date}
                  attention={
                    !draft.document_date
                      ? "No document date identified. Set a date or leave blank to use the scan date."
                      : undefined
                  }
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
          onClick={() => {
            setPrevious(null);
            setDrafts((drafts) => [
              ...drafts,
              {
                pages: "",
                title: "",
                owner_ids: ["unknown"],
                creators: [],
                document_date: "",
                review_reason: "",
                confidence: 1,
              },
            ]);
          }}
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
          <Button type="submit" loading={pending}>
            {scan.status === "complete"
              ? "Save page groups"
              : "Approve and file"}
          </Button>
        </div>
      </div>
      <ErrorNotice message={error} />
    </form>
  );
}

function toDrafts(proposal: Proposal): Draft[] {
  return proposal.documents.map((document) => ({
    ...document,
    pages: document.pages.join(", "),
    document_date: document.document_date ?? "",
  }));
}
