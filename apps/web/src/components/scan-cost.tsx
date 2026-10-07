import type { components } from "@/lib/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function ScanCost({
  scan,
}: {
  scan: components["schemas"]["ScanDetail"];
}) {
  const runs = Array.from({ length: scan.processing_run }, (_, index) => {
    const number = index + 1;
    const calls = scan.processing.filter(
      (call) => call.processing_run === number,
    );
    return {
      number,
      requests: calls.reduce((sum, call) => sum + call.requests, 0),
      total: calls.reduce(
        (sum, call) => sum + Number(call.estimated_cost_usd ?? 0),
        0,
      ),
      complete:
        calls.length > 0 &&
        calls.every(
          (call) => call.usage_complete && call.estimated_cost_usd !== null,
        ),
    };
  });
  return (
    <section className="space-y-3 p-3" aria-label="Scan processing cost">
      <h3 className="text-xs font-medium">Model cost by run</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Model requests</TableHead>
            <TableHead>Estimated USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.number}>
              <TableCell>
                {run.number}
                {run.number === scan.processing_run ? " · Current" : ""}
              </TableCell>
              <TableCell>{run.requests}</TableCell>
              <TableCell className="tabular-nums">
                ${run.total.toFixed(6)}
                {!run.complete ? " + unknown" : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Includes recorded retries. Costs update during processing. Local OCR has
        no model charge. Hardware, storage, and tax are excluded.
      </p>
    </section>
  );
}
