import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshCwIcon } from "@hugeicons/core-free-icons";
import { enrichDocument } from "@/lib/actions";
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

export function ReprocessDocument({
  document,
}: {
  document: components["schemas"]["Document"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const processing =
    document.enrichment_status === "pending" ||
    document.enrichment_status === "running";

  async function confirm() {
    setPending(true);
    setError("");
    try {
      await enrichDocument({ data: document.id });
      setOpen(false);
      await router.invalidate({ sync: true });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not reprocess this document",
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
        render={<PreviewAction icon={RefreshCwIcon} disabled={processing} />}
      >
        Reprocess
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Reprocess this document?</DialogTitle>
          <DialogDescription>
            Update the generated tags and summary with the current model.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Your PDF, filing details, and manual edits are kept.</li>
          <li>Current results stay available if processing fails.</li>
          <li>Model usage may incur a new charge.</li>
        </ul>
        <ErrorNotice message={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending || processing}
            loading={pending}
            icon={<HugeiconsIcon icon={RefreshCwIcon} />}
            onClick={() => void confirm()}
          >
            Reprocess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
