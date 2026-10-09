import { canAdmin } from "@/lib/auth/access";
import {
  createFileRoute,
  getRouteApi,
  redirect,
  stripSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { DocumentDetail } from "@/components/document-detail";
import {
  documentSearch,
  getDocument,
  getScanWithDocuments,
} from "@/lib/queries";

export const Route = createFileRoute("/documents/$documentId")({
  validateSearch: z.object({
    edit: z.boolean().default(false),
    verify: z.boolean().default(false),
  }),
  search: { middlewares: [stripSearchParams({ edit: false, verify: false })] },
  beforeLoad: ({ params, search, context }) => {
    if (search.view === "source" && !canAdmin(context.access)) {
      throw redirect({
        to: "/documents/$documentId",
        params,
        search: { ...search, view: "pdf" },
        replace: true,
      });
    }
    if (search.verify) {
      throw redirect({
        to: "/documents/$documentId",
        params,
        search: {
          ...documentSearch.parse(search),
          view: search.view,
          edit: search.edit,
        },
        replace: true,
      });
    }
    if (search.preview === true && !search.edit) {
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
    const source = await getScanWithDocuments({
      data: detail.document.scan_id,
    });
    return { ...detail, source };
  },
  component: DocumentPage,
});

function DocumentPage() {
  const detail = Route.useLoaderData();
  const { catalog } = getRouteApi("/documents").useLoaderData();
  const search = Route.useSearch();
  return (
    <DocumentDetail
      key={detail.document.id}
      {...detail}
      catalog={catalog}
      search={documentSearch.parse(search)}
      view={search.view}
      edit={search.edit}
      preview={false}
    />
  );
}
