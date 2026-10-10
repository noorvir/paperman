import type { ComponentProps, ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { statusTone } from "./status-tone";

export function StatusIcon({
  icon,
  label,
  tone,
  render,
  children,
  marker = false,
}: {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
  label: string;
  tone: "success" | "attention";
  render?: ComponentProps<typeof TooltipTrigger>["render"];
  children: ReactNode;
  marker?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={render ?? <span />}
        tabIndex={0}
        role={render ? undefined : "img"}
        aria-label={label}
        className={cn(
          "group/status-icon inline-flex size-6 shrink-0 items-center justify-center rounded-sm align-middle leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          marker && ["size-[17px] rounded-full border", statusTone({ tone })],
          tone === "success"
            ? "text-success-foreground"
            : "text-attention-foreground",
        )}
      >
        <HugeiconsIcon
          icon={icon}
          strokeWidth={1.5}
          className={cn(
            marker ? "size-2.5" : "size-5",
            "transition-[stroke-width] duration-150 group-hover/status-icon:stroke-2 group-focus-visible/status-icon:stroke-2 [&_*]:[stroke-width:inherit]",
          )}
          aria-hidden="true"
        />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
