import { useLiveData } from "@/hooks/use-live-data";
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  Link,
} from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons";
import { scanSearch, getScans } from "@/lib/queries";
import { EmptyState, PageHeader, formatDate } from "@/components/page";
import {
  Collection,
  CollectionFooter,
  SearchField,
  FileMark,
  ScanStatus,
} from "@/components/collection";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/scans/")({
  validateSearch: scanSearch,
  search: { middlewares: [stripSearchParams(scanSearch.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const scans = await getScans({ data: deps });
    if (deps.page > scans.pages)
      throw redirect({ to: "/scans", search: { ...deps, page: scans.pages } });
    return scans;
  },
  component: Scans,
});
function Scans() {
  useLiveData();
  const scans = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const labels = {
    "": "All scans",
    review: "Needs review",
    failed: "Failed",
    queued: "Queued",
    running: "Processing",
    complete: "Filed",
  };
  return (
    <>
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
      <nav aria-label="Scan status" className="view-tabs">
        {scanSearch.shape.status.unwrap().options.map((status) => (
          <Link
            key={status}
            to="/scans"
            search={{ ...search, status, page: 1 }}
            data-active={search.status === status}
            aria-current={search.status === status ? "page" : undefined}
          >
            {labels[status]}
          </Link>
        ))}
      </nav>
      <Collection
        toolbar={
          <>
            <SearchField
              value={search.q}
              placeholder="Search scans"
              onSearch={(q) =>
                void navigate({ search: { ...search, q, page: 1 } })
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
                <TableHead className="hidden text-right sm:table-cell">
                  Scanned
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.items.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <FileMark />
                      <div className="min-w-0">
                        <Link
                          to="/scans/$scanId"
                          params={{ scanId: scan.id }}
                          className="document-link"
                        >
                          {scan.original_name}
                        </Link>
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
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {formatDate(scan.scanned_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Collection>
    </>
  );
}
