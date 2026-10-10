import { useState, type FormEvent } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { createDocument } from "@/lib/actions";
import { canAdmin } from "@/lib/auth/access";
import { useAccess } from "./auth/access-context";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { PageHeader, ErrorNotice } from "./page";
import { BackLink } from "./back-link";
import { DetailViewLayout } from "./detail-view-layout";
import { DocumentEditorDetails } from "./document-editor-details";
import { PdfPreview } from "./pdf-preview";
import { Button } from "./ui/button";

export function CreateDocument({
  scan,
  documents,
  catalog,
}: {
  scan: components["schemas"]["Scan"];
  documents: components["schemas"]["Document"][];
  catalog: components["schemas"]["Catalog"];
}) {
  const access = useAccess();
  const [draft, setDraft] = useState<components["schemas"]["DocumentCreate"]>({
    title: "",
    source_pages: [],
    owner_ids: ["unknown"],
    creator_ids: [],
    tag_ids: [],
    document_date: null,
    filing_revision: scan.filing_revision,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const unsaved = useUnsavedChanges(JSON.stringify(draft));
  const navigate = useNavigate();
  const router = useRouter();
  const usedPages = new Set(
    documents.flatMap((document) => document.source_pages),
  );
  function cancel() {
    void navigate({ to: "/scans/$scanId", params: { scanId: scan.id } });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const document = await createDocument({
        data: { scanId: scan.id, value: draft },
      });
      unsaved.markSaved();
      await router.invalidate();
      await navigate({
        to: "/documents/$documentId",
        params: { documentId: document.id },
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not create this document",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3"
      style={{ containerName: "preview", containerType: "inline-size" }}
    >
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <PageHeader
        title="Create document"
        description={`Select pages from ${scan.original_name}. Other documents are kept.`}
        back={
          <BackLink
            to="/scans/$scanId"
            params={{ scanId: scan.id }}
            aria-label="Back to scan"
            title="Back to scan"
          />
        }
      />
      {scan.status !== "complete" ? (
        <p className="text-sm text-muted-foreground">
          Wait for this scan to finish before creating a document.
        </p>
      ) : (
        <DetailViewLayout
          editor={
            <form
              onSubmit={(event) => void submit(event)}
              className="flex min-h-0 flex-1 flex-col"
              aria-label="Create document"
            >
              <div className="mb-4 space-y-1 border-b pb-3">
                <h2 className="workspace-title">Document details</h2>
                <p className="text-xs text-muted-foreground" role="status">
                  {draft.source_pages.length
                    ? `Selected pages: ${draft.source_pages.join(", ")}`
                    : "Select at least one page in the preview."}
                </p>
                {draft.source_pages.some((page) => usedPages.has(page)) && (
                  <p className="text-xs text-muted-foreground">
                    Some selected pages are also used in another document.
                  </p>
                )}
              </div>
              <DocumentEditorDetails
                catalog={catalog}
                value={draft}
                onChange={setDraft}
                disabled={pending}
                canChangeOwners={canAdmin(access)}
              />
              <div className="mt-4 shrink-0 space-y-2 border-t pt-3">
                <ErrorNotice message={error} />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={cancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={pending}
                    disabled={
                      pending ||
                      !draft.source_pages.length ||
                      !draft.title.trim()
                    }
                  >
                    Create document
                  </Button>
                </div>
              </div>
            </form>
          }
        >
          <PdfPreview
            url={`/api/scans/${scan.id}/pdf?variant=searchable`}
            title={`Select pages from ${scan.original_name}`}
            pageSelection={{
              pages: draft.source_pages,
              disabled: pending,
              onToggle: (page) =>
                setDraft((current) => ({
                  ...current,
                  source_pages: current.source_pages.includes(page)
                    ? current.source_pages.filter((number) => number !== page)
                    : [...current.source_pages, page],
                })),
              onMove: (page, position) =>
                setDraft((current) => {
                  const pages = current.source_pages.filter(
                    (number) => number !== page,
                  );
                  pages.splice(position - 1, 0, page);
                  return { ...current, source_pages: pages };
                }),
            }}
          />
        </DetailViewLayout>
      )}
    </div>
  );
}
