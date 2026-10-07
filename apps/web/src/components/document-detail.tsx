import { Link, useNavigate } from "@tanstack/react-router";
import type { z } from "zod";
import type { components } from "@/lib/schema";
import { Pen01Icon } from "@hugeicons/core-free-icons";
import { PreviewAction } from "@/components/preview-action";
import { DocumentEditor } from "@/components/document-editor";
import { documentSearch, documentView } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { formatDate } from "@/components/page";
import { DocumentView } from "@/components/document-view";
import { DocumentTabs } from "@/components/document-tabs";
import { ReprocessDocument } from "@/components/reprocess-document";
import { DocumentFilterLink } from "@/components/document-filter-link";
import {
  CollectionPreview,
  OpenPreviewLink,
} from "@/components/collection-preview";

export function DocumentDetail({
  document,
  text,
  scanName,
  catalog,
  search,
  view,
  preview,
  edit,
}: {
  document: components["schemas"]["Document"];
  text: string;
  scanName: string;
  catalog: components["schemas"]["Catalog"];
  search: z.output<typeof documentSearch>;
  view: z.output<typeof documentView>;
  preview: boolean;
  edit: boolean;
}) {
  const navigate = useNavigate();
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
      description={
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
      actions={
        edit ? (
          <PreviewAction
            icon={Pen01Icon}
            nativeButton={false}
            render={
              <Link
                to="/scans/$scanId/review"
                params={{ scanId: document.scan_id }}
              />
            }
          >
            Edit pages
          </PreviewAction>
        ) : (
          <>
            <PreviewAction icon={Pen01Icon} onClick={() => setEditing(true)}>
              Edit
            </PreviewAction>
            <ReprocessDocument document={document} />
          </>
        )
      }
    >
      <DocumentView
        document={document}
        scanName={scanName}
        text={text}
        catalog={catalog}
        view={view}
        allowActions={!preview && !edit}
        sidebar={!preview}
        search={documentSearch.parse(search)}
        editor={
          edit ? (
            <DocumentEditor
              key={document.id}
              document={document}
              text={text}
              catalog={catalog}
              initialTab={view === "pdf" ? "details" : view}
              onDone={() => setEditing(false)}
            />
          ) : undefined
        }
      />
    </CollectionPreview>
  );
}
