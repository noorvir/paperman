import {
  createFileRoute,
  getRouteApi,
  stripSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DocumentEditor } from "@/components/document-editor";
import { getDocument, documentSearch } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { formatDate } from "@/components/page";
import { DocumentView } from "@/components/document-view";
import {
  CollectionPreview,
  OpenPreviewLink,
} from "@/components/collection-preview";

export const Route = createFileRoute("/documents/$documentId")({
  validateSearch: z.object({
    view: z.enum(["pdf", "text", "summary", "details"]).default("pdf"),
    preview: z.boolean().default(false),
    edit: z.boolean().default(false),
  }),
  search: {
    middlewares: [
      stripSearchParams({ view: "pdf", preview: false, edit: false }),
    ],
  },
  loader: ({ params }) => getDocument({ data: params.documentId }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { document, text } = Route.useLoaderData();
  const { catalog } = getRouteApi("/documents").useLoaderData();
  const search = Route.useSearch();
  const { view, edit } = search;
  const preview = search.preview && !edit;
  const navigate = Route.useNavigate();
  const owner = catalog.owners.find((owner) => owner.id === document.owner_id);
  function setEditing(edit: boolean) {
    void navigate({
      search: { ...search, preview: false, edit },
      resetScroll: false,
    });
  }
  return (
    <CollectionPreview
      id={document.id}
      title={document.title}
      description={`${owner?.name ?? document.owner_id} · ${formatDate(document.document_date)}`}
      preview={preview}
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
          search={{ ...search, preview: false }}
          resetScroll={false}
        />
      }
      actions={
        !edit && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )
      }
    >
      <div className="document-edit-layout" data-editing={edit}>
        <div className="document-read-view">
          <DocumentView
            document={document}
            text={text}
            catalog={catalog}
            view={view}
            allowActions={!preview && !edit}
          />
        </div>
        {edit && (
          <section
            className="document-edit-panel"
            aria-label="Edit document information"
          >
            <DocumentEditor
              key={document.id}
              document={document}
              text={text}
              catalog={catalog}
              onDone={() => setEditing(false)}
            />
          </section>
        )}
      </div>
    </CollectionPreview>
  );
}
