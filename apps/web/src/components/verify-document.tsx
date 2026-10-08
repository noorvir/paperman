import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { CircleCheckBigIcon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { verifyDocument } from "@/lib/actions";
import { Button } from "./ui/button";

export function VerifyDocument({
  document,
  onError,
}: {
  document: components["schemas"]["Document"];
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (pending || document.verification) {
      return;
    }
    setPending(true);
    onError("");
    try {
      await verifyDocument({
        data: {
          id: document.id,
          revision: document.revision,
          reviewer: "unknown",
        },
      });
      await router.invalidate({ sync: true });
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not verify this document",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      disabled={pending || Boolean(document.verification)}
      className={`active:not-aria-[haspopup]:translate-y-0 disabled:opacity-100 ${document.verification && !pending ? "invisible" : ""}`}
      aria-hidden={Boolean(document.verification) && !pending}
      loading={pending}
      icon={
        <HugeiconsIcon
          icon={CircleCheckBigIcon}
          className="size-3.5 text-muted-foreground"
        />
      }
      onClick={() => void confirm()}
    >
      Mark as verified
    </Button>
  );
}
