import { useLiveData } from "@/hooks/use-live-data";
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  Link,
  Outlet,
  useMatch,
} from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons";
import {
  CollectionWorkspace,
  CollectionLink,
  CollectionRow,
} from "@/components/collection-workspace";
import { scanSearch, getScans } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/page";
import { LocalTime } from "@/components/local-time";
import {
  Collection,
  CollectionFooter,
  SearchField,
  ScanStatus,
} from "@/components/collection";
import { FileIcon } from "@/components/file-icon";
import { SelectField } from "@/components/select-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/scans")({
  validateSearch: scanSearch,
  search: { middlewares: [stripSearchParams(scanSearch.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const scans = await getScans({ data: deps });
    if (deps.page > scans.pages) {
      throw redirect({ to: "/scans", search: { ...deps, page: scans.pages } });
    }
    return scans;
  },
  component: Scans,
});
function Scans() {
  useLiveData();
  const scans = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const detail = useMatch({ from: "/scans/$scanId", shouldThrow: false });
  const full = detail !== undefined && !detail.search.preview;
  const labels = {
    "": "All scans",
    review: "Needs review",
    failed: "Failed",
    queued: "Queued",
    running: "Processing",
    complete: "Filed",
  };
  return (
    <CollectionWorkspace
      full={full}
      items={scans.items}
      selectedId={detail?.params.scanId}
      onNavigate={(scanId, preview) =>
        navigate({
          to: "/scans/$scanId",
          params: { scanId },
          search: { ...search, preview, view: detail?.search.view ?? "pdf" },
          resetScroll: false,
          replace: preview && detail !== undefined,
        })
      }
    >
      <PageHeader
        title="Scans"
        description="From the scanner to your document library."
        count={scans.total}
      >
        <Link to="/scans/upload" className={buttonVariants()}>
          <HugeiconsIcon icon={Upload04Icon} />
          Upload scan
        </Link>
      </PageHeader>
      <Collection
        preview={<Outlet />}
        toolbar={
          <>
            <SearchField
              value={search.q}
              placeholder="Search scans"
              onSearch={(q) =>
                void navigate({ search: { ...search, q, page: 1 } })
              }
            />
            <SelectField
              label="Scan status"
              className="w-36"
              value={search.status}
              items={scanSearch.shape.status.unwrap().options.map((status) => ({
                value: status,
                label: labels[status],
              }))}
              onValueChange={(status) =>
                void navigate({
                  to: "/scans",
                  search: {
                    ...search,
                    status: scanSearch.shape.status.parse(status),
                    page: 1,
                  },
                })
              }
            />
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              Newest first · Updates automatically
            </span>
          </>
        }
        footer={
          <CollectionFooter {...scans} count={scans.items.length} noun="scans">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={search.page <= 1}
              onClick={() =>
                void navigate({ search: { ...search, page: search.page - 1 } })
              }
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={search.page >= scans.pages}
              onClick={() =>
                void navigate({ search: { ...search, page: search.page + 1 } })
              }
            >
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </CollectionFooter>
        }
      >
        {scans.items.length === 0 ? (
          <EmptyState
            title="No scans found"
            description="Try another search, or upload a PDF to get started."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[65%] md:w-[48%]">Scan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">
                  Documents
                </TableHead>
                <TableHead className="hidden sm:table-cell">Scanned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.items.map((scan) => (
                <CollectionRow key={scan.id} itemId={scan.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <FileIcon filename={scan.original_name} />
                      <div className="min-w-0">
                        <CollectionLink
                          itemId={scan.id}
                          selected={detail?.params.scanId === scan.id}
                          aria-label={`Preview ${scan.original_name}`}
                          to="/scans/$scanId"
                          params={{ scanId: scan.id }}
                          search={{ ...search, preview: true, view: "pdf" }}
                          resetScroll={false}
                        >
                          {scan.original_name}
                        </CollectionLink>
                        <p
                          className={`document-caption ${scan.status === "failed" ? "text-destructive" : ""}`}
                        >
                          {scan.status === "failed"
                            ? scan.history.at(-1)?.message
                            : `${scan.page_count || "—"} pages · ${scan.status === "review" ? "Confirm the proposed documents" : "Original PDF preserved"}`}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ScanStatus status={scan.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {scan.document_ids.length || "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    <LocalTime value={scan.scanned_at} dateOnly />
                  </TableCell>
                </CollectionRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Collection>
    </CollectionWorkspace>
  );
}
