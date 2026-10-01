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

export function RemoveOwner({
  owner,
  owners,
}: {
  owner: components["schemas"]["CatalogEntry"];
  owners: components["schemas"]["CatalogEntry"][];
}) {
  const router = useRouter();
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
        data: { kind: "owners", id: owner.id, reassignTo },
      });
      if (result.status === "in_use") {
        setReplacement("unknown");
        setUsage(result);
        return;
      }
      setUsage(null);
      await router.invalidate({ sync: true });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not remove this owner",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={usage !== null}
      onOpenChange={(open) => {
        if (!open && !pending) {
          setUsage(null);
          setError("");
        }
      }}
    >
      <div className="inline-flex max-w-full flex-col items-start gap-2">
        <DialogTrigger
          render={<Button variant="outline" disabled={pending} />}
          onClick={() => void remove()}
        >
          {pending && usage === null ? "Removing" : "Remove"}
        </DialogTrigger>
        {usage === null && <ErrorNotice message={error} />}
      </div>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Remove {owner.name}?</DialogTitle>
          <DialogDescription>
            {usage?.documents ?? 0} filed documents and {usage?.scans ?? 0} scan
            batches use this owner. Select their new owner before removal.
          </DialogDescription>
        </DialogHeader>
        <label className="field-label">
          Reassign to
          <SelectField
            label="Reassign to"
            value={replacement}
            disabled={pending}
            onValueChange={setReplacement}
            items={owners
              .filter((entry) => entry.id !== owner.id)
              .map((entry) => ({ value: entry.id, label: entry.name }))}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Documents are kept. Their stored files stay in the same location.
        </p>
        <ErrorNotice message={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button disabled={pending} onClick={() => void remove(replacement)}>
            {pending ? "Reassigning" : "Reassign and remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
