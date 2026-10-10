import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { deleteDocument } from "@/lib/actions";
import type { components } from "@/lib/schema";
import { ErrorNotice } from "./page";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";

export function DeleteDocument({
  document,
}: {
  document: components["schemas"]["Document"];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const router = useRouter();
  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await deleteDocument({
        data: { id: document.id, revision: document.revision },
      });
      setOpen(false);
      await navigate({ to: "/documents" });
      await router.invalidate();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete this document",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Delete document"
            title="Delete document"
          />
        }
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            Remove “{document.title}” from the library for all its owners.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The original scan and saved history are kept. You can create a new
          document from the scan if needed.
        </p>
        <ErrorNotice message={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            loading={pending}
            disabled={pending}
            onClick={() => void remove()}
          >
            <HugeiconsIcon icon={Delete02Icon} />
            Delete document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
