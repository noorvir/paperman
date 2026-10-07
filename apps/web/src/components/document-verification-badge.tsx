import { HugeiconsIcon } from "@hugeicons/react";
import { BadgeAlertIcon, BadgeCheckIcon } from "@hugeicons/core-free-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function DocumentVerificationBadge({ verified }: { verified: boolean }) {
  const label = verified ? "Verified" : "Not verified";

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        role="img"
        aria-label={label}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm align-middle leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <HugeiconsIcon
          icon={verified ? BadgeCheckIcon : BadgeAlertIcon}
          className={
            verified
              ? "size-5 text-emerald-600 dark:text-emerald-400"
              : "size-5 text-amber-600 dark:text-amber-400"
          }
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
