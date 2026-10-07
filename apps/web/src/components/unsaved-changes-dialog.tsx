import { useRef } from "react";
import type { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function UnsavedChangesDialog({
  blocker,
}: {
  blocker: ReturnType<typeof useUnsavedChanges>["blocker"];
}) {
  const keepEditing = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open) {
          blocker.reset?.();
        }
      }}
    >
      <DialogContent initialFocus={keepEditing}>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            Your changes have not been saved. Discard them to leave this page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={keepEditing}
            variant="outline"
            onClick={() => blocker.reset?.()}
          >
            Keep editing
          </Button>
          <Button variant="destructive" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
