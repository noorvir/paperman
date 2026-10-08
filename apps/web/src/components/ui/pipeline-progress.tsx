import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import type { ReactNode } from "react";
import type { components } from "@/lib/schema";
import { Button } from "./button";
import { statusTone } from "./status-tone";
import { Spinner } from "./spinner";

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
      className="relative overflow-x-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
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
          const color = tones[tone];
          const previousComplete = steps[index - 1]?.status === "complete";
          let marker: ReactNode = index + 1;
          if (count != null) {
            marker = count;
          } else if (status === "complete") {
            marker = <HugeiconsIcon icon={Tick02Icon} size={16} />;
          } else if (status === "failed") {
            marker = <HugeiconsIcon icon={Cancel01Icon} size={16} />;
          } else if (status === "running") {
            marker = <Spinner />;
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
                    previousComplete &&
                      count == null &&
                      "bg-success-foreground/35",
                    index === 0 && "invisible",
                  )}
                />
                {selection ? (
                  <Button
                    variant={color === "neutral" ? "secondary" : color}
                    size="icon-lg"
                    className={cn(
                      "mx-1.5 rounded-full border font-semibold tabular-nums aria-pressed:ring-2 aria-pressed:ring-current/25 aria-pressed:ring-offset-2",
                      statusTone({ tone: tones[tone] }),
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
                      statusTone({ tone: tones[tone] }),
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
                      "bg-success-foreground/35",
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
                {count == null ? states[status] : `${count}, ${label}`}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type PipelineStep = components["schemas"]["PipelineStep"];

const tones: Record<
  PipelineStep["status"],
  "neutral" | "attention" | "destructive" | "success"
> = {
  queued: "neutral",
  running: "attention",
  review: "attention",
  failed: "destructive",
  complete: "success",
};

const states = {
  queued: "Waiting",
  running: "Processing",
  review: "Needs review",
  failed: "Failed",
  complete: "Complete",
};
