import { useEffect, useState, type ComponentProps } from "react";
import { linkOptions, useNavigate, useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { BadgeCheckIcon } from "@hugeicons/core-free-icons";
import { verifyDocument } from "@/lib/actions";
import type { DocumentDetail } from "./document-detail";
import { CollectionPreview } from "./collection-preview";
import { BackLink } from "./back-link";
import { DocumentVerificationBadge } from "./document-verification-badge";
import { DocumentTabs } from "./document-tabs";
import { DocumentView } from "./document-view";
import { PdfPreview } from "./pdf-preview";
import { Button } from "./ui/button";
import { FileLink } from "./file-link";
import { ErrorNotice, formatDate } from "./page";

export function DocumentReview({
  document,
  scanName,
  text,
  catalog,
  search,
  view,
}: Omit<ComponentProps<typeof DocumentDetail>, "preview" | "edit">) {
  const navigate = useNavigate();
  const router = useRouter();
  const [panel, setPanel] = useState<"document" | "source">("document");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const owners = document.owner_ids
    .map((id) => catalog.owners.find((owner) => owner.id === id)?.name ?? id)
    .join(", ");
  const destination = linkOptions({
    to: "/documents/$documentId",
    params: { documentId: document.id },
    search: { ...search, view },
  });

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        pending ||
        window.document.querySelector(
          '[role="dialog"], [role="menu"], [role="listbox"]',
        )
      ) {
        return;
      }
      event.preventDefault();
      void navigate({
        to: "/documents/$documentId",
        params: { documentId: document.id },
        search: { ...search, view },
        replace: true,
      });
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [document.id, navigate, pending, search, view]);

  async function confirm() {
    if (pending || document.verification) {
      return;
    }
    setPending(true);
    setError("");
    try {
      await verifyDocument({
        data: {
          id: document.id,
          revision: document.revision,
          reviewer: "unknown",
        },
      });
      await router.invalidate({ sync: true });
      await navigate({ ...destination, replace: true });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not verify this document",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <CollectionPreview
      id={document.id}
      title={document.title}
      badge={document.verification && <DocumentVerificationBadge verified />}
      description={`${owners} · ${formatDate(document.document_date)}`}
      preview={false}
      onClose={() => void navigate(destination)}
      back={
        <BackLink
          {...destination}
          aria-label="Exit verification"
          aria-disabled={pending}
          onClick={(event) => {
            if (pending) {
              event.preventDefault();
            }
          }}
        />
      }
      openLink={null}
      actions={
        <>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void navigate(destination)}
          >
            Cancel
          </Button>
          {!document.verification && (
            <Button
              variant="success"
              disabled={pending}
              onClick={() => void confirm()}
            >
              <HugeiconsIcon icon={BadgeCheckIcon} />
              {pending ? "Verifying" : "Mark as verified"}
            </Button>
          )}
        </>
      }
    >
      <div className="shrink-0 space-y-1">
        <h2 className="workspace-title">Review document</h2>
        <p className="text-xs text-muted-foreground">
          Compare the document with source pages{" "}
          {document.source_pages.join(", ")}. Other source pages are dimmed.
        </p>
      </div>
      <ErrorNotice message={error} />
      <div
        className="verification-mobile-tabs view-tabs"
        role="tablist"
        aria-label="Comparison view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={panel === "document"}
          aria-controls="review-document"
          onClick={() => setPanel("document")}
        >
          Document
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === "source"}
          aria-controls="review-source"
          onClick={() => setPanel("source")}
        >
          Source scan
        </button>
      </div>
      <div className="verification-panels">
        <section
          id="review-document"
          aria-label="Document to verify"
          className="verification-panel"
          data-active={panel === "document"}
        >
          <DocumentTabs
            documentId={document.id}
            search={search}
            view={view}
            preview={false}
            edit={false}
            verify
          />
          <DocumentView
            document={document}
            text={text}
            scanName={scanName}
            catalog={catalog}
            search={search}
            view={view}
            sidebar={false}
            allowActions={false}
            pdfRevision={document.revision}
          />
        </section>
        <section
          id="review-source"
          aria-label="Source scan comparison"
          className="verification-panel"
          data-active={panel === "source"}
        >
          <div className="flex h-8 shrink-0 items-center border-b text-xs">
            <FileLink
              to="/scans/$scanId"
              params={{ scanId: document.scan_id }}
              search={{ preview: false, view: "pdf" }}
              target="_blank"
              rel="noopener noreferrer"
              filename={scanName}
            />
          </div>
          <PdfPreview
            url={`/api/scans/${document.scan_id}/pdf`}
            title={`Source scan: ${scanName}`}
            initialPage={document.source_pages[0]}
            highlightedPages={document.source_pages}
          />
        </section>
      </div>
    </CollectionPreview>
  );
}
