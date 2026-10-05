import { BackLink } from "@/components/back-link";
import { createFileRoute } from "@tanstack/react-router";
import { getCatalog, getDocument, getScan } from "@/lib/queries";
import { PdfPreview } from "@/components/pdf-preview";
import { ReviewForm } from "@/components/review-form";
import { PageHeader, DetailLayout } from "@/components/page";

export const Route = createFileRoute("/scans_/$scanId/review")({
  loader: async ({ params }) => {
    const [scan, catalog] = await Promise.all([
      getScan({ data: params.scanId }),
      getCatalog(),
    ]);
    const details = await Promise.all(
      scan.document_ids.map((id) => getDocument({ data: id })),
    );
    let proposal = scan.proposal;
    const documentRevisions = Object.fromEntries(
      details.map(({ document }) => [document.id, document.revision]),
    );
    if (scan.status === "complete") {
      proposal = {
        blank_pages: scan.proposal?.blank_pages ?? [],
        documents: details.map(({ document }) => {
          return {
            pages: document.source_pages,
            owner_id: document.owner_id,
            title: document.title,
            document_date:
              document.date_source === "document"
                ? document.document_date
                : null,
            confidence: 1,
            review_reason: "",
          };
        }),
      };
    }
    return { scan, catalog, proposal, documentRevisions };
  },
  component: Review,
});
function Review() {
  const { scan, catalog, proposal, documentRevisions } = Route.useLoaderData();
  return (
    <>
      <PageHeader
        back={
          <BackLink
            to="/scans/$scanId"
            params={{ scanId: scan.id }}
            aria-label="Back to scan"
            title="Back to scan"
          />
        }
        title={
          scan.status === "complete" ? "Edit page groups" : "Review documents"
        }
        description="Check each source page, document group, owner, title, and date."
      />
      {!["review", "complete"].includes(scan.status) || !proposal ? (
        <p>Wait for this scan to finish before editing its groups.</p>
      ) : (
        <DetailLayout
          wide
          aside={
            <ReviewForm
              scan={scan}
              key={scan.id}
              proposal={proposal}
              owners={catalog.owners}
              documentRevisions={documentRevisions}
            />
          }
        >
          <PdfPreview
            title="Searchable scan preview"
            url={`/api/scans/${scan.id}/pdf?variant=searchable`}
          />
        </DetailLayout>
      )}
    </>
  );
}
