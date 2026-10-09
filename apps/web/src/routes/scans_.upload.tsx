import { getInboxes } from "@/lib/queries";
import { BackLink } from "@/components/back-link";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page";
import { UploadForm } from "@/components/upload-form";

export const Route = createFileRoute("/scans_/upload")({
  loader: () => getInboxes(),
  component: UploadScan,
});
function UploadScan() {
  const inboxes = Route.useLoaderData();
  return (
    <>
      <PageHeader
        back={
          <BackLink
            to="/scans"
            search={{}}
            aria-label="Back to scans"
            title="Back to scans"
          />
        }
        title="Upload a scan"
        description="Add a PDF. PaperMan will prepare the documents for review."
      />
      <UploadForm inboxes={inboxes} />
    </>
  );
}
