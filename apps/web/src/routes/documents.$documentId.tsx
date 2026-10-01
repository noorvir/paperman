import {
  createFileRoute,
  getRouteApi,
  stripSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
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
  }),
  search: { middlewares: [stripSearchParams({ view: "pdf", preview: false })] },
  loader: ({ params }) => getDocument({ data: params.documentId }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { document, text } = Route.useLoaderData();
  const { catalog } = getRouteApi("/documents").useLoaderData();
  const search = Route.useSearch();
  const { view, preview } = search;
  const navigate = Route.useNavigate();
  const owner = catalog.owners.find((owner) => owner.id === document.owner_id);
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
    >
      <DocumentView
        document={document}
        text={text}
        catalog={catalog}
        view={view}
      />
    </CollectionPreview>
  );
}
