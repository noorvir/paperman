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
import { documentSearch, getCatalog, getDocuments } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/page";
import {
  Collection,
  CollectionFooter,
  SearchField,
} from "@/components/collection";
import {
  DocumentFilters,
  DocumentSort,
  ActiveFilters,
} from "@/components/document-filters";
import { Button, buttonVariants } from "@/components/ui/button";
import { CollectionWorkspace } from "@/components/collection-workspace";
import { DocumentTable } from "@/components/document-table";

export const Route = createFileRoute("/documents")({
  validateSearch: documentSearch,
  search: { middlewares: [stripSearchParams(documentSearch.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [documents, catalog] = await Promise.all([
      getDocuments({ data: deps }),
      getCatalog(),
    ]);
    if (deps.page > documents.pages) {
      throw redirect({
        to: "/documents",
        search: { ...deps, page: documents.pages },
      });
    }
    return { documents, catalog };
  },
  component: Documents,
});
function Documents() {
  useLiveData();
  const { documents, catalog } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const detail = useMatch({
    from: "/documents/$documentId",
    shouldThrow: false,
  });
  const full = detail !== undefined && !detail.search.preview;
  const change = (next: typeof search) => {
    void navigate({ to: "/documents", search: next });
  };
  return (
    <CollectionWorkspace
      full={full}
      items={documents.items}
      selectedId={detail?.params.documentId}
      onNavigate={(documentId, preview) =>
        navigate({
          to: "/documents/$documentId",
          params: { documentId },
          search: { ...search, preview, view: detail?.search.view ?? "pdf" },
          resetScroll: false,
          replace: preview && detail !== undefined,
        })
      }
    >
      <PageHeader
        title="Documents"
        description="Your paperwork, in one place."
        count={documents.total}
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
              placeholder="Search documents"
              onSearch={(q) => change({ ...search, q, page: 1 })}
            />
            <DocumentFilters
              search={search}
              catalog={catalog}
              onChange={change}
            />
            <div className="ml-auto">
              <DocumentSort
                value={search.sort}
                onChange={(sort) => change({ ...search, sort, page: 1 })}
              />
            </div>
            <ActiveFilters
              search={search}
              catalog={catalog}
              onChange={change}
            />
          </>
        }
        footer={
          <CollectionFooter
            {...documents}
            count={documents.items.length}
            noun="documents"
          >
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={search.page <= 1}
              onClick={() => change({ ...search, page: search.page - 1 })}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={search.page >= documents.pages}
              onClick={() => change({ ...search, page: search.page + 1 })}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </CollectionFooter>
        }
      >
        {documents.items.length === 0 ? (
          <EmptyState
            title="No documents found"
            description="Try another search or change your filters."
          />
        ) : (
          <DocumentTable
            documents={documents.items}
            catalog={catalog}
            search={search}
            selectedId={detail?.params.documentId}
          />
        )}
      </Collection>
    </CollectionWorkspace>
  );
}
