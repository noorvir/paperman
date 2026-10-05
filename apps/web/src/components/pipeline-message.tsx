import type { ReactNode } from "react";
import { cn } from "cn";

export function PipelineMessage({
  title,
  children,
  action,
  failed = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  failed?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2.5 text-xs",
        failed && "bg-destructive/5",
      )}
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className={cn("font-medium", failed && "text-destructive")}>
          {title}
        </p>
        {children && (
          <div className="mt-1 leading-5 text-muted-foreground">{children}</div>
        )}
      </div>
      {action}
    </div>
  );
}
