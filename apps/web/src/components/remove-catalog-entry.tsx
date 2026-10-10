import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { deleteEntry } from "@/lib/actions";
import type { components } from "@/lib/schema";
import { ErrorNotice } from "./page";
import { Button } from "./ui/button";
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
import { SelectField } from "./select-field";

export function RemoveCatalogEntry({
  entry,
  kind,
  owners,
}: {
  kind: "owners" | "tags" | "creators";
  entry: components["schemas"]["CatalogEntry"];
  owners: components["schemas"]["CatalogEntry"][];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<
    components["schemas"]["EntryRemoval"] | null
  >(null);
  const [replacement, setReplacement] = useState("unknown");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove(reassignTo?: string) {
    setPending(true);
    setError("");
    try {
      const result = await deleteEntry({
        data: { kind, id: entry.id, reassignTo },
      });
      if (result.status === "in_use") {
        setReplacement(kind === "owners" ? "unknown" : "");
        setUsage(result);
        return;
      }
      setOpen(false);
      setUsage(null);
      await router.invalidate({ sync: true });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not remove this entry",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!pending) {
          setOpen(open);
          setUsage(null);
          setError("");
        }
      }}
    >
      <div className="inline-flex max-w-full flex-col items-start gap-2">
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remove ${entry.name}`}
              title={`Remove ${entry.name}`}
              disabled={pending}
            />
          }
        >
          <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" />
        </DialogTrigger>
      </div>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Remove {entry.name}?</DialogTitle>
          <DialogDescription>
            {usage
              ? `${usage.documents} filed documents and ${usage.scans} scan batches use this entry. Select its replacement before removal.`
              : `Remove this ${kind === "owners" ? "owner" : kind === "creators" ? "creator" : "tag"} from the catalog? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        {usage && (
          <label className="field-label">
            Reassign to
            <SelectField
              label="Reassign to"
              value={replacement}
              disabled={pending}
              onValueChange={setReplacement}
              items={owners
                .filter((owner) => owner.id !== entry.id)
                .map((entry) => ({ value: entry.id, label: entry.name }))}
            />
          </label>
        )}
        <p className="text-xs text-muted-foreground">
          Documents are kept. Their stored files stay in the same location.
        </p>
        <ErrorNotice message={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            loading={pending}
            disabled={pending || Boolean(usage && !replacement)}
            onClick={() => void remove(usage ? replacement : undefined)}
          >
            {usage ? "Reassign and remove" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
