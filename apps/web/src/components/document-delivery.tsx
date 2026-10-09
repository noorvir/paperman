import { useState, type ComponentProps } from "react";
import { useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxIcon, SignpostIcon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { confirmDelivery } from "@/lib/actions";
import { useAccess } from "./auth/access-context";
import { Button } from "./ui/button";
import { StatusIcon } from "./ui/status-icon";
import { LocalTime } from "./local-time";

export function DocumentDelivery({
  document,
  action = false,
  render,
}: {
  document: components["schemas"]["Document"];
  action?: boolean;
  render?: ComponentProps<typeof StatusIcon>["render"];
}) {
  const access = useAccess();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (access.state !== "authenticated") return null;
  const confirmation = document.delivery_confirmation;
  const unknown = document.owner_ids.includes("unknown");
  const direct = document.inbox_id !== "shared";

  if (!action) {
    if (direct) {
      return (
        <StatusIcon
          icon={InboxIcon}
          label={`Direct to personal inbox: ${document.title}`}
          tone="success"
          render={render}
        >
          Sent directly to a personal inbox. No routing needed.
        </StatusIcon>
      );
    }
    return (
      <StatusIcon
        icon={SignpostIcon}
        label={`${confirmation ? "Routed" : "Not routed"}: ${document.title}`}
        tone={confirmation ? "success" : "attention"}
        render={render}
      >
        {confirmation ? (
          <span>
            Routed by {confirmation.by} on <LocalTime value={confirmation.at} />
          </span>
        ) : (
          "Not routed yet"
        )}
      </StatusIcon>
    );
  }

  if (direct || access.role !== "admin" || access.mode !== "admin") return null;

  async function route() {
    if (pending || confirmation || unknown) return;
    setPending(true);
    setError("");
    try {
      await confirmDelivery({
        data: { id: document.id, revision: document.revision },
      });
      await router.invalidate({ sync: true });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not route this document",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <Button
        variant="outline"
        loading={pending}
        disabled={pending || Boolean(confirmation) || unknown}
        aria-hidden={Boolean(confirmation) && !pending}
        className={confirmation && !pending ? "invisible" : ""}
        title={unknown ? "Choose the owners before routing" : undefined}
        icon={
          <HugeiconsIcon
            icon={SignpostIcon}
            className="size-3.5 text-muted-foreground"
          />
        }
        onClick={() => void route()}
      >
        Route
      </Button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border bg-background p-2 text-left text-xs text-destructive"
        >
          {error}
        </span>
      )}
    </span>
  );
}
