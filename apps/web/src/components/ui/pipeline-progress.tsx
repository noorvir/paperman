import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import type { ReactNode } from "react";
import type { components } from "@/lib/schema";
import { Button } from "./button";

export function PipelineProgress<Id extends string>({
  label,
  steps,
  selection,
  spacing = "even",
}: {
  label: string;
  spacing?: "even" | "wide";
  steps: (Omit<PipelineStep, "id"> & { id: Id })[];
  selection?: {
    value: Id | undefined;
    onChange: (id: Id) => void;
    controls: string;
  };
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <ol className="flex min-w-max py-2">
        {steps.map((step, index) => {
          const { id, label, status, detail, count } = step;
          let tone = status;
          if (count === 0) {
            tone = "queued";
          } else if (count != null && status === "queued") {
            tone = "running";
          }
          const previousComplete = steps[index - 1]?.status === "complete";
          let marker: ReactNode = index + 1;
          if (count != null) {
            marker = count;
          } else if (status === "complete") {
            marker = <HugeiconsIcon icon={Tick02Icon} size={16} />;
          } else if (status === "failed") {
            marker = <HugeiconsIcon icon={Cancel01Icon} size={16} />;
          } else if (status === "running") {
            marker = (
              <span className="size-3.5 rounded-full border-[1.5px] border-current border-t-transparent motion-safe:animate-spin" />
            );
          } else if (status === "review") {
            marker = "!";
          }
          return (
            <li
              key={id}
              className={cn(
                "min-w-24 flex-1 text-center",
                spacing === "wide" && "first:flex-[0.75] last:flex-[0.75]",
              )}
              aria-current={
                count == null && status !== "queued" && status !== "complete"
                  ? "step"
                  : undefined
              }
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px bg-border",
                    previousComplete && count == null && "bg-emerald-500/50",
                    index === 0 && "invisible",
                  )}
                />
                {selection ? (
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className={cn(
                      "mx-1.5 rounded-full border font-semibold tabular-nums aria-pressed:ring-2 aria-pressed:ring-ring/40 aria-pressed:ring-offset-2",
                      tones[tone],
                    )}
                    aria-label={`${label}: ${count ?? ""} ${detail}`}
                    aria-pressed={selection.value === id}
                    aria-controls={selection.controls}
                    onClick={() => selection.onChange(id)}
                  >
                    {marker}
                  </Button>
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                      tones[tone],
                    )}
                  >
                    {marker}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px bg-border",
                    status === "complete" &&
                      count == null &&
                      "bg-emerald-500/50",
                    index === steps.length - 1 && "invisible",
                  )}
                />
              </div>
              <p className="mt-2 text-xs font-medium">{label}</p>
              {detail && (
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  {detail}
                </p>
              )}
              <span className="sr-only">
                {count == null ? states[status] : `${count}, ${states[status]}`}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type PipelineStep = components["schemas"]["PipelineStep"];

const tones = {
  queued: "border-border bg-muted/30 text-muted-foreground",
  running:
    "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  review:
    "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  failed:
    "border-red-300 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  complete:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const states = {
  queued: "Waiting",
  running: "Processing",
  review: "Needs review",
  failed: "Failed",
  complete: "Complete",
};
