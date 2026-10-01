import {
  createFileRoute,
  getRouteApi,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";
import { Dialog } from "@base-ui/react/dialog";
import { useRef } from "react";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FullScreenIcon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { getDocument, documentSearch } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { PageHeader, formatDate } from "@/components/page";
import { DocumentView } from "@/components/document-view";
import { Button, buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/documents/$documentId")({
  validateSearch: z.object({
    view: z.enum(["pdf", "text", "details"]).default("pdf"),
    preview: z.boolean().default(false),
  }),
  search: { middlewares: [stripSearchParams({ view: "pdf", preview: false })] },
  loader: ({ params }) => getDocument({ data: params.documentId }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { document, text } = Route.useLoaderData();
  const { catalog } = getRouteApi("/documents").useLoaderData();
  const search = Route.useSearch();
  const { view, preview } = search;
  const navigate = Route.useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const owner = catalog.owners.find((owner) => owner.id === document.owner_id);
  const close = () =>
    navigate({
      to: "/documents",
      search: documentSearch.parse(search),
      resetScroll: false,
    });

  return (
    <div ref={container} className="contents">
      <Dialog.Root
        open
        modal={false}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (!open) {
            void close();
          }
        }}
      >
        <Dialog.Portal container={container}>
          <Dialog.Popup
            className="document-preview"
            data-preview={preview}
            aria-label={preview ? `Preview: ${document.title}` : document.title}
            initialFocus={false}
            finalFocus={() =>
              window.document.getElementById(`document-${document.id}`)
            }
          >
            <PageHeader
              back={
                !preview && (
                  <BackLink
                    to="/documents"
                    search={documentSearch.parse(search)}
                    resetScroll={false}
                    aria-label="All documents"
                    title="All documents"
                  />
                )
              }
              title={document.title}
              description={`${owner?.name ?? document.owner_id} · ${formatDate(document.document_date)}`}
            >
              {preview && (
                <>
                  <Link
                    to="/documents/$documentId"
                    params={{ documentId: document.id }}
                    search={{ ...search, preview: false }}
                    resetScroll={false}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon" }),
                    )}
                    title="Open full view"
                    aria-label="Open full view"
                  >
                    <HugeiconsIcon icon={FullScreenIcon} />
                  </Link>
                  <Dialog.Close
                    render={<Button variant="ghost" size="icon" />}
                    aria-label="Close preview"
                    title="Close preview"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} />
                  </Dialog.Close>
                </>
              )}
            </PageHeader>
            <DocumentView
              document={document}
              text={text}
              catalog={catalog}
              view={view}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
