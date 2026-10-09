import { getSessionAccess } from "@/lib/auth/functions";
import { canAdmin } from "@/lib/auth/access";
import { useAccess } from "@/components/auth/access-context";
import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { OverviewAttention } from "@/components/overview-attention";
import { useLiveData } from "@/hooks/use-live-data";
import {
  createFileRoute,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";
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
  validateSearch: dashboardSearch,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search: { status, page } }) => ({ status, page }),
  loader: async ({ deps }) => {
    const access = await getSessionAccess();
    const admin = canAdmin(access);
    const [state, documents, review, failed, catalog] = await Promise.all([
      getDashboard({ data: deps }),
      getDocuments({ data: documentSearch.parse({}) }),
      admin ? getScans({ data: scanSearch.parse({ status: "review" }) }) : null,
      admin ? getScans({ data: scanSearch.parse({ status: "failed" }) }) : null,
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
  const admin = canAdmin(useAccess());
  const { state, documents, attention, catalog, selectedStatus } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const mobile = useIsMobile();
  const [panel, setPanel] = useState("documents");
  const work = (
    <OverviewWork
      work={state.pipeline_items}
      recent={documents.items.slice(0, 8)}
      catalog={catalog}
      filtered={selectedStatus !== undefined}
      onReset={() => {
        void navigate({
          search: { ...search, status: undefined, page: 1 },
          resetScroll: false,
        });
      }}
      onPage={(page) =>
        void navigate({ search: { ...search, page }, resetScroll: false })
      }
    />
  );
  const sidebar = (
    <OverviewAttention
      state={state}
      attention={attention}
      onViewAll={() => setPanel("documents")}
    />
  );
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
          {admin && (
            <Link to="/scans/upload" className={buttonVariants()}>
              <HugeiconsIcon icon={Upload04Icon} /> Upload scan
            </Link>
          )}
        </PageHeader>
        {admin && (
          <OverviewSummary
            counts={state.counts}
            status={search.status}
            onSelect={(status) => {
              setPanel("documents");
              void navigate({
                search: {
                  ...search,
                  status: status === search.status ? undefined : status,
                  page: 1,
                },
                resetScroll: false,
              });
            }}
          />
        )}
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
