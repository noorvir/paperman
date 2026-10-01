import { BackLink } from "@/components/back-link";
import { createFileRoute } from "@tanstack/react-router";
import { getCatalog, getScan } from "@/lib/queries";
import { PdfPreview } from "@/components/pdf-preview";
import { ReviewForm } from "@/components/review-form";
import { PageHeader, DetailLayout } from "@/components/page";

export const Route = createFileRoute("/scans/$scanId_/review")({
  loader: async ({ params }) => {
    const [scan, catalog] = await Promise.all([
      getScan({ data: params.scanId }),
      getCatalog(),
    ]);
    return { scan, catalog };
  },
  component: Review,
});
function Review() {
  const { scan, catalog } = Route.useLoaderData();
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
        title="Review documents"
        description="Check the document groups, owners, titles, and dates before filing."
      />
      {scan.status !== "review" || !scan.proposal ? (
        <p>This scan is not waiting for review.</p>
      ) : (
        <DetailLayout
          wide
          aside={
            <ReviewForm
              scan={scan}
              proposal={scan.proposal}
              owners={catalog.owners}
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
