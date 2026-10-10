import { persistedSearch } from "@/lib/search-preferences";
import { Tabs } from "@base-ui/react/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { OverviewAttention } from "@/components/overview-attention";
import { useLiveData } from "@/hooks/use-live-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload04Icon } from "@hugeicons/core-free-icons";
import {
  getDashboard,
  getCatalog,
  getDocuments,
  getScans,
  documentSearch,
  scanSearch,
  dashboardSearch,
} from "@/lib/queries";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { OverviewSummary } from "@/components/overview-summary";
import { OverviewWork } from "@/components/overview-work";

export const Route = createFileRoute("/")({
  ...persistedSearch(dashboardSearch, {
    name: "overview",
    schema: dashboardSearch.omit({ page: true }),
  }),
  loaderDeps: ({ search }) =>
    dashboardSearch.omit({ panel: true }).parse(search),
  loader: async ({ deps }) => {
    const [state, documents, review, failed, catalog] = await Promise.all([
      getDashboard({ data: deps }),
      getDocuments({ data: documentSearch.parse({}) }),
      getScans({ data: scanSearch.parse({ status: "review" }) }),
      getScans({ data: scanSearch.parse({ status: "failed" }) }),
      getCatalog(),
    ]);
    return {
      state,
      selectedStatus: deps.status,
      catalog,
      documents,
      attention: [...(failed?.items ?? []), ...(review?.items ?? [])].slice(
        0,
        5,
      ),
    };
  },
  component: Overview,
  // Retain the current layout and results until the selected status is ready.
  pendingMs: Infinity,
});

function Overview() {
  useLiveData();
  const { state, documents, attention, catalog, selectedStatus } =
    Route.useLoaderData();
  const search = dashboardSearch.parse(Route.useSearch());
  const navigate = Route.useNavigate();
  const mobile = useIsMobile();
  const panel = search.panel;
  const setPanel = (panel: string) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        panel: dashboardSearch.shape.panel.parse(panel),
      }),
      resetScroll: false,
    });
  const work = (
    <OverviewWork
      work={state.pipeline_items}
      recent={documents.items.slice(0, 8)}
      catalog={catalog}
      filtered={selectedStatus !== ""}
      onReset={() => {
        void navigate({
          search: (previous) => ({ ...previous, status: "", page: 1 }),
          resetScroll: false,
        });
      }}
      onPage={(page) =>
        void navigate({ search: { ...search, page }, resetScroll: false })
      }
    />
  );
  const sidebar = <OverviewAttention state={state} attention={attention} />;
  return (
    <div className="workspace-page min-h-0 max-w-6xl flex-1 shrink overflow-hidden">
      <div
        hidden={mobile && panel === "attention"}
        className="flex shrink-0 flex-col gap-5 border-b pb-3 [&[hidden]]:hidden"
      >
        <PageHeader
          title="Overview"
          description="A clear view of your paperwork."
        >
          <Link to="/scans/upload" className={buttonVariants()}>
            <HugeiconsIcon icon={Upload04Icon} /> Upload scan
          </Link>
        </PageHeader>
        <OverviewSummary
          counts={state.counts}
          status={search.status || undefined}
          onSelect={(status) => {
            void navigate({
              search: (previous) => ({
                ...previous,
                status: status === previous.status ? "" : status,
                panel: "documents",
                page: 1,
              }),
              resetScroll: false,
            });
          }}
        />
      </div>
      {mobile ? (
        <Tabs.Root
          value={panel}
          onValueChange={setPanel}
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <Tabs.List className="view-tabs" aria-label="Overview sections">
            <Tabs.Tab value="documents">Documents</Tabs.Tab>
            <Tabs.Tab value="attention">Needs attention</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel
            value="documents"
            className="flex min-h-0 flex-1 flex-col"
          >
            {work}
          </Tabs.Panel>
          <Tabs.Panel
            value="attention"
            className="flex min-h-0 flex-1 flex-col"
          >
            {sidebar}
          </Tabs.Panel>
        </Tabs.Root>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] grid-rows-[minmax(0,1fr)] gap-8">
          {work}
          {sidebar}
        </div>
      )}
    </div>
  );
}
