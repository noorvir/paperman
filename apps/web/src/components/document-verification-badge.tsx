import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BadgeAlertIcon, BadgeCheckIcon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { LocalTime } from "./local-time";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function DocumentVerificationBadge({
  verification,
  render,
}: {
  verification: components["schemas"]["Document"]["verification"];
  render?: ComponentProps<typeof TooltipTrigger>["render"];
}) {
  const label = verification ? "Verified" : "Not verified";

  return (
    <Tooltip>
      <TooltipTrigger
        render={render ?? <span />}
        tabIndex={0}
        role={render ? undefined : "img"}
        aria-label={label}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm align-middle leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <HugeiconsIcon
          icon={verification ? BadgeCheckIcon : BadgeAlertIcon}
          className={
            verification
              ? "size-5 text-emerald-600 dark:text-emerald-400"
              : "size-5 text-amber-600 dark:text-amber-400"
          }
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent>
        {verification ? (
          <>
            Verified by {verification.by} on{" "}
            <LocalTime value={verification.at} />
          </>
        ) : (
          "Not verified yet"
        )}
      </TooltipContent>
    </Tooltip>
  );
}
