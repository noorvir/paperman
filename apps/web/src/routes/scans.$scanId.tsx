import { BackLink } from "@/components/back-link";
import { useLiveData } from "@/hooks/use-live-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getScan } from "@/lib/queries";
import { retryScan } from "@/lib/actions";
import {
  ActionButton,
  PageHeader,
  DetailLayout,
  formatDate,
} from "@/components/page";
import { ScanStatus, FileMark } from "@/components/collection";
import { PdfPreview } from "@/components/pdf-preview";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/scans/$scanId")({
  loader: ({ params }) => getScan({ data: params.scanId }),
  component: ScanDetail,
});
function ScanDetail() {
  useLiveData();
  const scan = Route.useLoaderData();
  return (
    <>
      <PageHeader
        back={
          <BackLink
            to="/scans"
            search={{}}
            aria-label="All scans"
            title="All scans"
          />
        }
        title={scan.original_name}
        description={`${scan.page_count || "—"} pages · Scanned ${formatDate(scan.scanned_at)}`}
      >
        <ScanStatus status={scan.status} />
      </PageHeader>
      <DetailLayout
        aside={
          <>
            {scan.status === "failed" && (
              <Alert variant="destructive">
                <AlertTitle>Processing stopped</AlertTitle>
                <AlertDescription>
                  {scan.history.at(-1)?.message}
                  <div className="mt-3">
                    <ActionButton action={() => retryScan({ data: scan.id })}>
                      Retry failed stage
                    </ActionButton>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {scan.status === "review" && (
              <div className="flex flex-col items-start gap-3 rounded-md bg-amber-500/5 p-3">
                <div>
                  <p className="text-sm font-medium">Ready for your review</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirm the proposed groups and owners before filing.
                  </p>
                </div>
                <Link
                  to="/scans/$scanId/review"
                  params={{ scanId: scan.id }}
                  className={buttonVariants()}
                >
                  Review documents
                </Link>
              </div>
            )}
            {scan.document_ids.length > 0 && (
              <section>
                <h2 className="workspace-title mb-3">Filed documents</h2>
                <div className="divide-y">
                  {scan.document_ids.map((id, index) => (
                    <Link
                      to="/documents/$documentId"
                      params={{ documentId: id }}
                      key={id}
                      className="flex items-center gap-2 py-3 text-xs font-medium hover:underline"
                    >
                      <FileMark />
                      <span>
                        {scan.proposal?.documents[index]?.title ??
                          `Document ${index + 1}`}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="workspace-title mb-4">Activity</h2>
              <ol className="space-y-5">
                {scan.history.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="border-l-2 pl-3">
                    <p className="text-xs leading-relaxed">{event.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      <time>{formatDate(event.at)}</time> ·{" "}
                      <span className="capitalize">{event.stage}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </section>
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Source details
              </summary>
              <dl className="mt-3 space-y-2 break-all text-xs">
                <dt className="font-medium">SHA-256</dt>
                <dd className="text-muted-foreground">{scan.content_hash}</dd>
                <dt className="font-medium">Timestamp source</dt>
                <dd className="text-muted-foreground">
                  {scan.timestamp_source}
                </dd>
              </dl>
            </details>
          </>
        }
      >
        <PdfPreview title="Original scan" url={`/api/scans/${scan.id}/pdf`} />
      </DetailLayout>
    </>
  );
}
