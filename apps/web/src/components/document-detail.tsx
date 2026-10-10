import { DeleteDocument } from "./delete-document";
import { canAdmin } from "@/lib/auth/access";
import { useAccess } from "./auth/access-context";
import { useState, type ComponentProps } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { z } from "zod";
import type { components } from "@/lib/schema";
import { Pen01Icon } from "@hugeicons/core-free-icons";
import { PreviewAction } from "@/components/preview-action";
import { DocumentEditor } from "@/components/document-editor";
import { documentSearch, documentView } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { ErrorNotice, formatDate } from "@/components/page";
import { DocumentView } from "@/components/document-view";
import { DocumentTabs } from "@/components/document-tabs";
import { VerifyDocument } from "@/components/verify-document";
import { DocumentDelivery } from "./document-delivery";
import { DocumentFileIcon } from "./document-file-icon";
import { DocumentProcessingStatus } from "./document-processing-status";
import { DocumentVerificationBadge } from "./document-verification-badge";
import { ReprocessDocument } from "@/components/reprocess-document";
import { DocumentFilterLink } from "@/components/document-filter-link";
import {
  CollectionPreview,
  OpenPreviewLink,
} from "@/components/collection-preview";

export function DocumentDetail({
  document,
  text,
  source,
  sourceReference,
  can_manage_access,
  can_edit_pages,
  can_delete,
  catalog,
  search,
  view,
  preview,
  edit,
}: {
  document: components["schemas"]["Document"];
  text: string;
  sourceReference: components["schemas"]["SourceReference"];
  can_manage_access: boolean;
  can_edit_pages: boolean;
  can_delete: boolean;
  source: ComponentProps<typeof DocumentView>["source"];
  catalog: components["schemas"]["Catalog"];
  search: z.output<typeof documentSearch>;
  view: z.output<typeof documentView>;
  preview: boolean;
  edit: boolean;
}) {
  const admin = canAdmin(useAccess());
  const navigate = useNavigate();
  const [pageDraft, setPageDraft] = useState(() =>
    getPageDraft(
      document,
      source?.scan.page_count ?? document.source_pages.length,
      edit,
    ),
  );
  if (pageDraft.edit !== edit || pageDraft.documentId !== document.id) {
    setPageDraft(
      getPageDraft(
        document,
        source?.scan.page_count ?? document.source_pages.length,
        edit,
      ),
    );
  }
  const [saving, setSaving] = useState(false);
  const [verificationError, setVerificationError] = useState({
    documentId: document.id,
    message: "",
  });
  const date = formatDate(document.document_date);
  function setEditing(edit: boolean) {
    void navigate({
      to: "/documents/$documentId",
      params: { documentId: document.id },
      search: { ...search, view, edit },
      resetScroll: false,
    });
  }
  return (
    <CollectionPreview
      id={document.id}
      title={document.title}
      icon={<DocumentFileIcon document={document} search={search} size="lg" />}
      titleLink={
        <Link
          to="/documents/$documentId"
          params={{ documentId: document.id }}
          search={{ ...search, view }}
          className="hover:underline underline-offset-4"
        >
          {document.title}
        </Link>
      }
      badge={
        <span className="inline-flex shrink-0 items-center gap-1">
          <DocumentVerificationBadge
            verification={document.verification}
            render={
              preview ? (
                <Link
                  to="/documents/$documentId"
                  params={{ documentId: document.id }}
                  search={{ ...search, view }}
                />
              ) : undefined
            }
          />
          <DocumentProcessingStatus document={document} />
        </span>
      }
      description={
        <span className="flex flex-wrap items-start justify-between gap-x-4">
          <span className="-ml-1 flex flex-wrap items-center gap-x-0.5">
            {document.owner_ids.map((id) => {
              const name =
                catalog.owners.find((owner) => owner.id === id)?.name ?? id;
              return (
                <DocumentFilterLink
                  key={id}
                  search={search}
                  filter={{ owner: [id] }}
                  aria-label={`Filter by owner: ${name}`}
                  className="h-5"
                >
                  {name}
                </DocumentFilterLink>
              );
            })}
            <span aria-hidden="true"> · </span>
            <DocumentFilterLink
              search={search}
              filter={{
                after: document.document_date,
                before: document.document_date,
              }}
              aria-label={`Filter by document date: ${date}`}
              className="h-5"
            >
              {date}
            </DocumentFilterLink>
          </span>
          {edit && source && can_edit_pages && (
            <span
              className="ml-auto text-right whitespace-normal"
              role="status"
            >
              {pageDraft.pages.length
                ? `Selected pages: ${pageDraft.pages.join(", ")}`
                : "Select at least one page."}
            </span>
          )}
        </span>
      }
      preview={preview}
      navigation={
        !edit && (
          <DocumentTabs
            documentId={document.id}
            search={search}
            view={view}
            preview={preview}
            edit={edit}
            showSource
          />
        )
      }
      onClose={() =>
        void navigate({
          to: "/documents",
          search: documentSearch.parse(search),
          resetScroll: false,
        })
      }
      back={
        <BackLink
          to="/documents"
          search={documentSearch.parse(search)}
          resetScroll={false}
          aria-label="All documents"
          title="All documents"
        />
      }
      openLink={
        <OpenPreviewLink
          to="/documents/$documentId"
          params={{ documentId: document.id }}
          search={{ ...search, view }}
          resetScroll={false}
        />
      }
      primaryAction={
        !preview &&
        !edit && (
          <VerifyDocument
            key={document.id}
            document={document}
            onError={(message) =>
              setVerificationError({ documentId: document.id, message })
            }
          />
        )
      }
      actions={
        !edit && (
          <>
            {!preview && (
              <DocumentDelivery key={document.id} document={document} action />
            )}
            <PreviewAction icon={Pen01Icon} onClick={() => setEditing(true)}>
              Edit
            </PreviewAction>
            <ReprocessDocument document={document} />
            {!preview && can_delete && <DeleteDocument document={document} />}
          </>
        )
      }
    >
      <ErrorNotice
        message={
          verificationError.documentId === document.id
            ? verificationError.message
            : ""
        }
      />
      <DocumentView
        key={document.id}
        document={document}
        pdfRevision={edit ? pageDraft.revision : document.pdf_revision}
        rotations={
          edit && source && can_edit_pages ? pageDraft.rotations : undefined
        }
        onRotatePage={
          edit && source && can_edit_pages && !saving
            ? (page) => {
                setPageDraft((current) => ({
                  ...current,
                  rotations: current.rotations.map((angle, index) =>
                    index === page - 1 ? (angle + 90) % 360 : angle,
                  ),
                }));
              }
            : undefined
        }
        pageSelection={
          edit && source && can_edit_pages
            ? {
                pages: pageDraft.pages,
                disabled: saving,
                onMove: (page, position) =>
                  setPageDraft((current) => {
                    const pages = current.pages.filter(
                      (number) => number !== page,
                    );
                    pages.splice(position - 1, 0, page);
                    return { ...current, pages };
                  }),
                onToggle: (page) =>
                  setPageDraft((current) => ({
                    ...current,
                    pages: current.pages.includes(page)
                      ? current.pages.filter((number) => number !== page)
                      : [...current.pages, page],
                  })),
              }
            : undefined
        }
        source={source}
        sourceReference={sourceReference}
        canEditPages={can_edit_pages}
        text={text}
        catalog={catalog}
        view={view}
        allowActions={!preview && !edit}
        preview={preview}
        search={documentSearch.parse(search)}
        editor={
          edit ? (
            <DocumentEditor
              key={document.id}
              document={document}
              canChangeOwners={admin && can_manage_access}
              text={text}
              pages={pageDraft.pages}
              rotations={pageDraft.rotations.map(
                (angle, index) =>
                  (angle - (pageDraft.initialRotations[index] ?? 0) + 360) %
                  360,
              )}
              onSaving={setSaving}
              catalog={catalog}
              onDone={() => setEditing(false)}
            />
          ) : undefined
        }
      />
    </CollectionPreview>
  );
}

function getPageDraft(
  document: components["schemas"]["Document"],
  pageCount: number,
  edit: boolean,
) {
  const rotations = new Array<number>(pageCount).fill(0);
  for (const rotation of document.manual_rotations) {
    const sourcePage = document.source_pages[rotation.page - 1];
    if (sourcePage !== undefined) {
      rotations[sourcePage - 1] = rotation.clockwise;
    }
  }
  return {
    edit,
    documentId: document.id,
    revision: document.pdf_revision,
    pages: [...document.source_pages],
    rotations,
    initialRotations: [...rotations],
  };
}
