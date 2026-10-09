import type { components } from "@/lib/schema";
import { LocalTime } from "./local-time";
import { ScanStatus } from "./collection";
import { FileLink } from "./file-link";

export function ScanInformation({
  scan,
  documents,
}: {
  scan: components["schemas"]["ScanDetail"];
  documents: components["schemas"]["Document"][];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-xs">
      <h2 className="workspace-title break-words">{scan.original_name}</h2>
      <dl className="space-y-4">
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Inbox</dt>
          <dd>
            {scan.inbox_id === "shared" ? "Shared inbox" : "Personal inbox"}
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <ScanStatus status={scan.status} />
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Scanned at</dt>
          <dd>
            <LocalTime value={scan.scanned_at} />
          </dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Pages</dt>
          <dd>{scan.page_count || "Not processed"}</dd>
        </div>
        <div className="space-y-1.5">
          <dt className="text-muted-foreground">Processing run</dt>
          <dd>{scan.processing_run}</dd>
        </div>
      </dl>
      <section
        className="space-y-3 border-t pt-4"
        aria-label="Extracted documents"
      >
        <h3 className="workspace-title">
          Documents{" "}
          <span className="font-normal text-muted-foreground">
            {documents.length}
          </span>
        </h3>
        {documents.length ? (
          <div className="space-y-1">
            {documents.map((document) => (
              <FileLink
                key={document.id}
                to="/documents/$documentId"
                params={{ documentId: document.id }}
                filename={document.final_path.slice(
                  document.final_path.lastIndexOf("/") + 1,
                )}
              >
                {document.title}
              </FileLink>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No filed documents yet.</p>
        )}
      </section>
    </div>
  );
}
