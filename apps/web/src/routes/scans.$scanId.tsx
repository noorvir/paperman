import {
  Link,
  createFileRoute,
  stripSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { getScan, getCatalog, getDocument, scanSearch } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { formatDate } from "@/components/page";
import { ScanStatus } from "@/components/collection";
import {
  CollectionPreview,
  OpenPreviewLink,
} from "@/components/collection-preview";
import { ScanView } from "@/components/scan-view";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/scans/$scanId")({
  validateSearch: z.object({
    preview: z.boolean().default(false),
    view: z.enum(["pdf", "documents", "activity", "details"]).default("pdf"),
  }),
  search: { middlewares: [stripSearchParams({ view: "pdf", preview: false })] },
  loader: async ({ params }) => {
    const [scan, catalog] = await Promise.all([
      getScan({ data: params.scanId }),
      getCatalog(),
    ]);
    const details = await Promise.all(
      scan.document_ids.map((id) => getDocument({ data: id })),
    );
    return {
      scan,
      catalog,
      documents: details.map((detail) => detail.document),
    };
  },
  component: ScanDetail,
});
function ScanDetail() {
  const { scan, catalog, documents } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CollectionPreview
      id={scan.id}
      title={scan.original_name}
      description={`${scan.page_count || "—"} pages · Scanned ${formatDate(scan.scanned_at)}`}
      preview={search.preview}
      actions={
        <>
          {scan.status === "complete" && (
            <Link
              to="/scans/$scanId/review"
              params={{ scanId: scan.id }}
              className={buttonVariants({ variant: "outline" })}
            >
              Edit page groups
            </Link>
          )}
          <ScanStatus status={scan.status} />
        </>
      }
      onClose={() =>
        void navigate({
          to: "/scans",
          search: scanSearch.parse(search),
          resetScroll: false,
        })
      }
      back={
        <BackLink
          to="/scans"
          search={scanSearch.parse(search)}
          resetScroll={false}
          aria-label="All scans"
          title="All scans"
        />
      }
      openLink={
        <OpenPreviewLink
          to="/scans/$scanId"
          params={{ scanId: scan.id }}
          search={{ ...search, preview: false }}
          resetScroll={false}
        />
      }
    >
      <ScanView
        scan={scan}
        catalog={catalog}
        documents={documents}
        view={search.view}
      />
    </CollectionPreview>
  );
}
