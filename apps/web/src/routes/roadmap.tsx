import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { features } from "@/components/roadmap/features";
import { formatDate } from "@/components/page";

export const Route = createFileRoute("/roadmap")({ component: Roadmap });

function Roadmap() {
  const ordered = [...features].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div className="workspace-page max-w-6xl">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-4 border-b pb-3 text-base font-semibold tracking-tight">
          Roadmap
        </h1>
        <ol aria-label="Feature roadmap">
          {ordered.map((feature, index) => (
            <li key={feature.id} className="grid grid-cols-[1.5rem_1fr] gap-4">
              <div aria-hidden="true" className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                    feature.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {feature.done && (
                    <HugeiconsIcon icon={Tick02Icon} size={16} />
                  )}
                </span>
                {index < ordered.length - 1 && (
                  <span
                    className={cn(
                      "my-0.5 w-0.5 flex-1",
                      feature.done ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 pb-7">
                <p className="mb-1 text-xs leading-6 text-muted-foreground">
                  {feature.done ? "Completed" : "Planned"}
                  <span aria-hidden="true" className="mx-2">
                    ·
                  </span>
                  {feature.date ? (
                    <>
                      <time dateTime={feature.date}>
                        {formatDate(feature.date)}
                      </time>
                    </>
                  ) : (
                    "Date not set"
                  )}
                </p>
                <h2 className="text-sm font-medium">{feature.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
