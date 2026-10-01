import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export function PageHeader({
  title,
  description,
  children,
  count,
  back,
}: {
  title: string;
  description: string;
  count?: number;
  children?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="workspace-heading">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {back}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1
              className="truncate text-base font-semibold tracking-tight"
              title={title}
            >
              {title}
            </h1>
            {count !== undefined && (
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </div>
          <p
            className="truncate text-xs leading-5 text-muted-foreground"
            title={description}
          >
            {description}
          </p>
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </header>
  );
}
export function DetailLayout({
  children,
  aside,
  toolbar,
  wide = false,
}: {
  children: ReactNode;
  aside: ReactNode;
  toolbar?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="detail-layout" data-wide={wide}>
      <section className="detail-primary">
        {toolbar}
        <div className="detail-content">{children}</div>
      </section>
      <aside className="detail-inspector" aria-label="Document information">
        {aside}
      </aside>
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Action failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
export function PageLoading() {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-3"
      aria-label="Loading page"
      aria-busy="true"
    >
      <div className="workspace-heading">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <Skeleton className="h-8 w-64 shrink-0" />
      {[0, 1, 2, 3].map((key) => (
        <Skeleton className="h-10 w-full" key={key} />
      ))}
    </section>
  );
}
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <section className="workspace-section">
      <ErrorNotice
        message={
          error instanceof Error ? error.message : "Could not load this page"
        }
      />
      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <details className="text-xs">
          <summary className="cursor-pointer">Error details</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3">
            {error.stack}
          </pre>
        </details>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </section>
  );
}
export function ActionButton({
  action,
  children,
  disabled = false,
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function run() {
    setPending(true);
    setError("");
    try {
      await action();
      await router.invalidate();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="inline-flex max-w-full flex-col items-start gap-2">
      <Button
        variant="outline"
        disabled={pending || disabled}
        onClick={() => void run()}
      >
        {pending ? "Working" : children}
      </Button>
      <ErrorNotice message={error} />
    </div>
  );
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
