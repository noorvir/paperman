import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BadgeCheckIcon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { verifyDocument } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { PreviewAction } from "./preview-action";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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

export function VerifyDocument({
  document,
}: {
  document: components["schemas"]["Document"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setPending(true);
    setError("");
    try {
      await verifyDocument({
        data: {
          id: document.id,
          revision: document.revision,
          reviewer: reviewer.trim(),
        },
      });
      await router.invalidate({ sync: true });
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not verify this document",
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
      <DialogTrigger render={<PreviewAction icon={BadgeCheckIcon} />}>
        Verify
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Verify this document</DialogTitle>
            <DialogDescription>
              Confirm that you have checked the document and its details.
            </DialogDescription>
          </DialogHeader>
          <label className="field-label">
            Your name
            <Input
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
              required
              maxLength={120}
              autoComplete="name"
              disabled={pending}
            />
          </label>
          <ErrorNotice message={error} />
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !reviewer.trim()}>
              {pending ? "Verifying" : "Mark as verified"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
