import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshCwIcon } from "@hugeicons/core-free-icons";
import { reprocessScan } from "@/lib/actions";
import type { components } from "@/lib/schema";
import { ErrorNotice } from "./page";
import { Button } from "./ui/button";
import { PreviewAction } from "./preview-action";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function ReprocessScan({
  scan,
  documents,
}: {
  scan: components["schemas"]["ScanDetail"];
  documents: components["schemas"]["Document"][];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setPending(true);
    setError("");
    try {
      await reprocessScan({
        data: {
          id: scan.id,
          filing_revision: scan.filing_revision,
          document_revisions: Object.fromEntries(
            documents.map((document) => [document.id, document.revision]),
          ),
        },
      });
      setOpen(false);
      await router.invalidate({ sync: true });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not reprocess this scan",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          setError("");
        }
      }}
    >
      <DialogTrigger
        render={
          <PreviewAction
            icon={RefreshCwIcon}
            disabled={documents.some(
              (document) => document.enrichment_status === "running",
            )}
          />
        }
      >
        Reprocess
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Replace {documents.length} documents?</DialogTitle>
          <DialogDescription>
            Reprocess this scan with the current model and settings.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">
              Replace results.
            </strong>{" "}
            New documents will replace the current files and manual edits.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Keep the original.
            </strong>{" "}
            Current results stay available until replacements are filed, then
            move to the archive.
          </li>
          <li>Model usage may incur a new charge.</li>
        </ul>
        <ErrorNotice message={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => void confirm()}
          >
            <HugeiconsIcon icon={RefreshCwIcon} />
            {pending ? "Starting new run" : "Reprocess and replace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
