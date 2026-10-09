import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { getDocumentAccess } from "@/lib/queries";
import { saveDocumentAccess } from "@/lib/actions";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ErrorNotice } from "./page";

export function DocumentAccess({
  document,
}: {
  document: components["schemas"]["Document"];
}) {
  const [access, setAccess] = useState<
    components["schemas"]["DocumentAccess"] | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getDocumentAccess({ data: document.id })
      .then((value) => {
        if (!cancelled) {
          setAccess(value);
          setSelected(value.user_ids);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load recipients",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [document.id, open]);

  async function save() {
    if (!access) return;
    setPending(true);
    setError("");
    try {
      await saveDocumentAccess({
        data: {
          id: document.id,
          revision: access.revision,
          user_ids: selected,
        },
      });
      await router.invalidate({ sync: true });
      setOpen(false);
      setAccess(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save access",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="workspace-title">Document access</h3>
      <p className="text-xs text-muted-foreground">
        {document.delivery_status === "review"
          ? "Choose recipients to deliver this shared document."
          : "Sharing this document does not share its source scan."}
      </p>
      {!open ? (
        <Button
          variant="outline"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          Manage access
        </Button>
      ) : (
        <div className="space-y-3">
          {!access && !error && (
            <div
              className="h-20 animate-pulse rounded bg-muted"
              aria-label="Loading recipients"
            />
          )}
          {access && (
            <>
              {access.recipients.length === 0 && (
                <p className="text-xs">
                  Create an account before choosing recipients.
                </p>
              )}
              <fieldset disabled={pending} className="space-y-2">
                <legend className="sr-only">Recipients</legend>
                {access.recipients.map((inbox) => {
                  const userId = inbox.account_id;
                  if (!userId) return null;
                  const owner = userId === access.owner_user_id;
                  return (
                    <label
                      key={userId}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Checkbox
                        disabled={owner}
                        checked={owner || selected.includes(userId)}
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked
                              ? [...current, userId]
                              : current.filter((id) => id !== userId),
                          )
                        }
                      />
                      {inbox.name}
                      {access.suggested_user_ids.includes(userId) && (
                        <span className="text-muted-foreground">Suggested</span>
                      )}
                    </label>
                  );
                })}
              </fieldset>
              <p className="text-xs text-muted-foreground">
                Check the pages and recipients before saving. Owner labels do
                not grant access.
              </p>
            </>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setAccess(null);
              }}
            >
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={!access || pending}
              onClick={() => void save()}
            >
              Save access
            </Button>
          </div>
        </div>
      )}
      <ErrorNotice message={error} />
    </section>
  );
}
