import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FeatureCategory } from "@/components/roadmap/features";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { features } from "@/components/roadmap/features";
import { formatDate } from "@/components/page";

export const Route = createFileRoute("/roadmap")({ component: Roadmap });

function Roadmap() {
  const [category, setCategory] = useState<FeatureCategory | "All">("All");
  const ordered = features
    .filter((feature) => category === "All" || feature.category === category)
    .sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div className="workspace-page max-w-6xl">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-4 border-b pb-3 text-base font-semibold tracking-tight">
          Roadmap
        </h1>
        <div
          className="mb-6 flex flex-wrap gap-1"
          role="group"
          aria-label="Filter roadmap"
        >
          <Button
            variant={category === "All" ? "secondary" : "ghost"}
            aria-pressed={category === "All"}
            onClick={() => setCategory("All")}
          >
            All
          </Button>
          <Button
            variant={category === "Internal" ? "secondary" : "ghost"}
            aria-pressed={category === "Internal"}
            onClick={() => setCategory("Internal")}
          >
            Internal
          </Button>
          <Button
            variant={category === "User facing" ? "secondary" : "ghost"}
            aria-pressed={category === "User facing"}
            onClick={() => setCategory("User facing")}
          >
            User facing
          </Button>
        </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium">{feature.title}</h2>
                  <Badge variant="secondary">{feature.category}</Badge>
                </div>
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
