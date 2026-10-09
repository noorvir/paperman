import type { ComponentProps } from "react";
import { BadgeAlertIcon, BadgeCheckIcon } from "@hugeicons/core-free-icons";
import type { components } from "@/lib/schema";
import { LocalTime } from "./local-time";
import { StatusIcon } from "./ui/status-icon";

export function DocumentVerificationBadge({
  verification,
  render,
}: {
  verification: components["schemas"]["Document"]["verification"];
  render?: ComponentProps<typeof StatusIcon>["render"];
}) {
  return (
    <StatusIcon
      icon={verification ? BadgeCheckIcon : BadgeAlertIcon}
      label={verification ? "Verified" : "Not verified"}
      tone={verification ? "success" : "attention"}
      render={render}
    >
      {verification ? (
        <>
          Verified by {verification.by} on <LocalTime value={verification.at} />
        </>
      ) : (
        "Not verified yet"
      )}
    </StatusIcon>
  );
}
