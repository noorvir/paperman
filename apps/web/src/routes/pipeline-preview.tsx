import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/page";
import {
  PipelineProgress,
  type PipelineStep,
} from "@/components/ui/pipeline-progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineMessage } from "@/components/pipeline-message";

export const Route = createFileRoute("/pipeline-preview")({
  component: PipelinePreview,
});

function PipelinePreview() {
  const [scenario, setScenario] = useState<Scenario>(scenarios[0]);
  const steps = stages.map((stage, index): PipelineStep => {
    let status: PipelineStep["status"] = "queued";
    let detail = "Waiting";
    if (index < scenario.step || scenario.status === "complete") {
      status = "complete";
      detail = "Done";
    } else if (index === scenario.step) {
      status = scenario.status;
      detail = scenario.stepLabel;
    }
    return { ...stage, status, detail, count: null };
  });

  return (
    <div className="workspace-page max-w-5xl">
      <PageHeader
        title="Processing pipeline"
        description="Component preview · Sample data"
      >
        <Badge variant="secondary">Preview</Badge>
      </PageHeader>

      <section className="space-y-4" aria-labelledby="scan-example">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="scan-example" className="workspace-title">
              One scan
            </h2>
            <p className="mt-1 workspace-description">
              Change the state to compare the indicator.
            </p>
          </div>
          <div
            role="group"
            aria-label="Example state"
            className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1"
          >
            {scenarios.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                aria-pressed={scenario.label === item.label}
                className="aria-pressed:bg-background aria-pressed:shadow-xs"
                onClick={() => setScenario(item)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <HugeiconsIcon
              icon={File01Icon}
              size={20}
              className="shrink-0 text-muted-foreground"
            />
            <div className="min-w-0">
              <h3 className="truncate text-xs font-medium">Monday mail.pdf</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                12 pages · 4 documents
              </p>
            </div>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {scenario.label}
            </span>
          </div>
          <div className="px-3 py-5 sm:px-5">
            <PipelineProgress
              label="Monday mail processing steps"
              steps={steps}
            />
          </div>
        </div>
        <PipelineMessage
          title={scenario.title}
          failed={scenario.status === "failed"}
        >
          {scenario.description}
        </PipelineMessage>
        <p className="text-[11px] text-muted-foreground sm:hidden">
          Swipe the steps to see the full pipeline.
        </p>
      </section>

      <section className="mt-4 space-y-4" aria-labelledby="overview-example">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="overview-example" className="workspace-title">
              Pipeline overview
            </h2>
            <p className="mt-1 workspace-description">
              Documents at each step · Sample snapshot
            </p>
          </div>
          <p className="text-xs text-muted-foreground">21 documents today</p>
        </div>
        <div className="rounded-lg border px-3 py-5 sm:px-5">
          <PipelineProgress
            label="Documents at each pipeline step"
            steps={overview}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />8 complete
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-500" />
            12 remaining
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-red-500" />1 failed
          </span>
        </div>
      </section>
    </div>
  );
}

const stages: Pick<PipelineStep, "id" | "label">[] = [
  { id: "inbox", label: "Inbox" },
  { id: "ocr", label: "OCR" },
  { id: "analyze", label: "Analysis" },
  { id: "review", label: "Review" },
  { id: "file", label: "File" },
  { id: "tag", label: "Tag" },
  { id: "ready", label: "Ready" },
];

type Scenario = {
  label: string;
  step: number;
  status: PipelineStep["status"];
  stepLabel: string;
  title: string;
  description: string;
};

const scenarios = [
  {
    label: "Processing",
    step: 2,
    status: "running",
    stepLabel: "2 of 4",
    title: "Identifying document 2 of 4",
    description:
      "Reading the owner, title, and date. The original scan is safe.",
  },
  {
    label: "Needs review",
    step: 3,
    status: "review",
    stepLabel: "Your turn",
    title: "4 documents are ready for review",
    description: "Check the page groups, owners, and dates before filing.",
  },
  {
    label: "Failed",
    step: 2,
    status: "failed",
    stepLabel: "Stopped",
    title: "The model connection timed out",
    description:
      "The original scan and completed steps are saved. Identification needs a retry.",
  },
  {
    label: "Complete",
    step: 6,
    status: "complete",
    stepLabel: "Done",
    title: "4 documents added to your library",
    description:
      "Searchable PDFs, owners, titles, dates, tags, and summaries are ready.",
  },
] satisfies [Scenario, ...Scenario[]];

const overview: PipelineStep[] = [
  {
    id: "inbox",
    label: "Inbox",
    status: "queued",
    count: 3,
    detail: "In queue",
  },
  {
    id: "ocr",
    label: "OCR",
    status: "running",
    count: 2,
    detail: "Reading text",
  },
  {
    id: "analyze",
    label: "Analysis",
    status: "running",
    count: 5,
    detail: "Split and identify",
  },
  {
    id: "review",
    label: "Review",
    status: "review",
    count: 2,
    detail: "Your turn",
  },
  {
    id: "file",
    label: "File",
    status: "queued",
    count: 0,
    detail: "Saving PDFs",
  },
  {
    id: "tag",
    label: "Tag",
    status: "failed",
    count: 1,
    detail: "Needs retry",
  },
  {
    id: "ready",
    label: "Ready",
    status: "complete",
    count: 8,
    detail: "In your library",
  },
];
