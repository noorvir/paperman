import {
  createFileRoute,
  getRouteApi,
  redirect,
  stripSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { DocumentDetail } from "@/components/document-detail";
import { DocumentReview } from "@/components/document-review";
import { documentSearch, getDocument, getScan } from "@/lib/queries";

export const Route = createFileRoute("/documents/$documentId")({
  validateSearch: z.object({
    edit: z.boolean().default(false),
    verify: z.boolean().default(false),
  }),
  search: { middlewares: [stripSearchParams({ edit: false, verify: false })] },
  beforeLoad: ({ params, search }) => {
    if (search.preview === true && !search.edit && !search.verify) {
      throw redirect({
        to: "/documents",
        search: {
          ...documentSearch.parse(search),
          preview: params.documentId,
          view: search.view,
        },
        replace: true,
      });
    }
  },
  loader: async ({ params }) => {
    const detail = await getDocument({ data: params.documentId });
    const scan = await getScan({ data: detail.document.scan_id });
    return { ...detail, scanName: scan.original_name };
  },
  component: DocumentPage,
});

function DocumentPage() {
  const detail = Route.useLoaderData();
  const { catalog } = getRouteApi("/documents").useLoaderData();
  const search = Route.useSearch();
  if (search.verify && !search.edit) {
    return (
      <DocumentReview
        {...detail}
        catalog={catalog}
        search={documentSearch.parse(search)}
        view={search.view}
      />
    );
  }
  return (
    <DocumentDetail
      {...detail}
      catalog={catalog}
      search={documentSearch.parse(search)}
      view={search.view}
      edit={search.edit}
      preview={false}
    />
  );
}
