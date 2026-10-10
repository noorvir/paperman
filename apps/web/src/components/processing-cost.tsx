import type { components } from "@/lib/schema";
import { processingLabels } from "@/lib/processing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function ProcessingCost({
  processing,
}: {
  processing: components["schemas"]["UsageAllocation"][];
}) {
  if (processing.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        Processing cost was not recorded for this document.
      </p>
    );
  }

  const total = processing.reduce(
    (sum, item) => sum + Number(item.estimated_cost_usd ?? 0),
    0,
  );
  const complete = processing.every(
    (item) => item.estimated_cost_usd !== null && item.call.usage_complete,
  );
  return (
    <section className="space-y-3 p-3" aria-label="Processing cost">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <h3 className="font-medium">Processing cost</h3>
        <p>
          {complete ? "Estimated total" : "Known subtotal"}:{" "}
          <span className="font-medium tabular-nums">${total.toFixed(6)}</span>{" "}
          USD
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Document share</TableHead>
            <TableHead>Estimated USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processing.map(({ call, share, estimated_cost_usd }) => (
            <TableRow key={call.id}>
              <TableCell>
                <div className="font-medium">
                  {processingLabels[call.stage]}
                  {call.status === "failed" ? " · Failed" : ""}
                </div>
                <div className="mt-1 text-muted-foreground">{call.model}</div>
              </TableCell>
              <TableCell className="tabular-nums">
                {call.seconds.toFixed(1)} s
              </TableCell>
              <TableCell className="tabular-nums">
                {(Number(share) * 100).toFixed(1)}%
              </TableCell>
              <TableCell className="tabular-nums">
                {estimated_cost_usd === null
                  ? "Unknown"
                  : `$${Number(estimated_cost_usd).toFixed(6)}`}
                {!call.usage_complete && estimated_cost_usd !== null
                  ? " + unknown"
                  : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Shared scan costs are divided by page count. Times are for the full
        step. Includes recorded retries. Local OCR has no model API charge.
        Hardware, storage and tax are excluded.
      </p>
      {!complete && (
        <p className="text-xs text-muted-foreground">
          Some usage or prices are missing. The subtotal is not a full cost
          estimate.
        </p>
      )}
    </section>
  );
}
