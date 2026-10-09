import { useLiveData } from "@/hooks/use-live-data";
import { z } from "zod";
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
  documentSearch,
  documentView,
  getCatalog,
  getDocuments,
  getDocument,
  getScanWithDocuments,
} from "@/lib/queries";
import { DocumentDetail } from "@/components/document-detail";
import { EmptyState, PageHeader } from "@/components/page";
import {
  Collection,
  CollectionFooter,
  SearchField,
} from "@/components/collection";
import { DocumentFilters } from "@/components/document-filters";
import { Button, buttonVariants } from "@/components/ui/button";
import { CollectionWorkspace } from "@/components/collection-workspace";
import { DocumentCollection } from "@/components/document-collection";
import { DocumentLayoutToggle } from "@/components/document-layout-toggle";

export const Route = createFileRoute("/documents")({
  validateSearch: documentSearch.extend({
    preview: z
      .union([z.string(), z.literal(true)])
      .catch("")
      .default(""),
    view: documentView.default("pdf"),
  }),
  search: {
    middlewares: [
      stripSearchParams({
        ...documentSearch.parse({}),
        preview: "",
        view: "pdf",
      }),
    ],
  },
  loaderDeps: ({ search }) => ({
    ...documentSearch.parse(search),
    preview: typeof search.preview === "string" ? search.preview : "",
  }),
  loader: async ({ deps }) => {
    const [documents, catalog, preview] = await Promise.all([
      getDocuments({ data: deps }),
      getCatalog(),
      deps.preview ? getDocument({ data: deps.preview }) : null,
    ]);
    if (deps.page > documents.pages) {
      throw redirect({
        to: "/documents",
        search: { ...deps, page: documents.pages },
      });
    }
    let source = null;
    if (preview?.source.accessible) {
      source = await getScanWithDocuments({ data: preview.document.scan_id });
    }
    return { documents, catalog, preview, source };
  },
  component: Documents,
});
function Documents() {
  useLiveData();
  const { documents, catalog, preview, source } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const detail = useMatch({
    from: "/documents/$documentId",
    shouldThrow: false,
  });
  const full = detail !== undefined;
  const change = (next: z.output<typeof documentSearch>) => {
    void navigate({ to: "/documents", search: documentSearch.parse(next) });
  };
  return (
    <CollectionWorkspace
      full={full}
      items={documents.items}
      selectedId={preview?.document.id}
      onNavigate={(documentId, preview) => {
        if (preview) {
          return navigate({
            to: "/documents",
            search: { ...search, preview: documentId },
            resetScroll: false,
            replace: Boolean(search.preview),
          });
        }
        return navigate({
          to: "/documents/$documentId",
          params: { documentId },
          search: { ...documentSearch.parse(search), view: search.view },
          resetScroll: false,
        });
      }}
    >
      <PageHeader
        title="Documents"
        description={
          search.delivery === "review"
            ? "Shared documents waiting for delivery"
            : "Your document library"
        }
        count={documents.total}
      >
        <Link to="/scans/upload" className={buttonVariants()}>
          <HugeiconsIcon icon={Upload04Icon} />
          Upload scan
        </Link>
      </PageHeader>
      <Collection
        preview={
          full ? (
            <Outlet />
          ) : (
            preview && (
              <DocumentDetail
                {...preview}
                sourceReference={preview.source}
                source={source}
                catalog={catalog}
                search={documentSearch.parse(search)}
                view={search.view}
                preview
                edit={false}
              />
            )
          )
        }
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
            <div className="ml-auto flex items-center gap-3">
              <DocumentLayoutToggle
                value={search.layout}
                onChange={(layout) =>
                  void navigate({
                    search: (previous) => ({ ...previous, layout }),
                    resetScroll: false,
                  })
                }
              />
            </div>
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
          <DocumentCollection
            layout={search.layout}
            documents={documents.items}
            catalog={catalog}
            search={search}
            selectedId={preview?.document.id}
            onSort={(sort) => change({ ...search, sort, page: 1 })}
          />
        )}
      </Collection>
    </CollectionWorkspace>
  );
}
