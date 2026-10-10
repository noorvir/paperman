import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { persistedSearch } from "@/lib/search-preferences";
import { pdfSearch, scanViewSearch } from "@/lib/search";
import { Add01Icon, Pen01Icon } from "@hugeicons/core-free-icons";
import { getScanWithDocuments, getCatalog, scanSearch } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { ScanStatus } from "@/components/collection";
import {
  CollectionPreview,
  OpenPreviewLink,
} from "@/components/collection-preview";
import { ScanView } from "@/components/scan-view";
import { ScanNavigation } from "@/components/scan-navigation";
import { ReprocessScan } from "@/components/reprocess-scan";
import { PreviewAction } from "@/components/preview-action";

const searchSchema = scanViewSearch.extend(pdfSearch.shape).extend({
  preview: z.boolean().default(false),
});
export const Route = createFileRoute("/scans/$scanId")({
  ...persistedSearch(
    searchSchema,
    { name: "scan-view", schema: scanViewSearch },
    { name: "pdf", schema: pdfSearch, retain: true },
  ),
  loader: async ({ params }) => {
    const [source, catalog] = await Promise.all([
      getScanWithDocuments({ data: params.scanId }),
      getCatalog(),
    ]);
    if (!source) {
      throw new Error("This source is not available to your account");
    }
    return { ...source, catalog };
  },
  component: ScanDetail,
});
function ScanDetail() {
  const { scan, catalog, documents } = Route.useLoaderData();
  const rawSearch = Route.useSearch();
  const search = { ...rawSearch, ...searchSchema.parse(rawSearch) };
  const navigate = Route.useNavigate();
  return (
    <CollectionPreview
      id={scan.id}
      title={scan.original_name}
      titleLink={
        <Link
          to="/scans/$scanId"
          params={{ scanId: scan.id }}
          search={{ ...search, preview: false }}
          className="hover:underline underline-offset-4"
        >
          {scan.original_name}
        </Link>
      }
      badge={<ScanStatus status={scan.status} />}
      description={
        <>
          {scan.page_count || "—"} pages · Scanned{" "}
          <LocalTime value={scan.scanned_at} dateOnly />
        </>
      }
      preview={search.preview}
      navigation={
        <ScanNavigation scan={scan} documents={documents} view={search.view} />
      }
      actions={
        <>
          {scan.status === "complete" && (
            <PreviewAction
              icon={Add01Icon}
              nativeButton={false}
              render={
                <Link to="/scans/$scanId/create" params={{ scanId: scan.id }} />
              }
            >
              Create document
            </PreviewAction>
          )}
          {scan.status === "complete" && (
            <PreviewAction
              icon={Pen01Icon}
              nativeButton={false}
              render={
                <Link to="/scans/$scanId/review" params={{ scanId: scan.id }} />
              }
            >
              Edit pages
            </PreviewAction>
          )}
          {scan.status === "complete" && (
            <ReprocessScan scan={scan} documents={documents} />
          )}
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
        layout={search.layout}
        onLayoutChange={(layout) =>
          void navigate({
            search: (previous) => ({ ...previous, layout }),
            resetScroll: false,
          })
        }
        sidebar={!search.preview}
      />
    </CollectionPreview>
  );
}
