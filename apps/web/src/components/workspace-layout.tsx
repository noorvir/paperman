import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon } from "@hugeicons/core-free-icons";

export function WorkspaceLayout({
  children,
  demo,
}: {
  children: ReactNode;
  demo: boolean;
}) {
  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
      <header className="workspace-toolbar">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold"
          aria-label="PaperMan overview"
        >
          <HugeiconsIcon icon={File01Icon} size={20} />
          <span className="hidden sm:inline">PaperMan</span>
        </Link>
        <nav aria-label="Main navigation" className="workspace-nav">
          <Link to="/" activeOptions={{ exact: true }}>
            Overview
          </Link>
          <Link to="/documents" search={{}}>
            Documents
          </Link>
          <Link to="/scans" search={{}}>
            Scans
          </Link>
          <Link to="/settings">Settings</Link>
        </nav>
        {demo && (
          <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:block">
            Demo workspace
          </span>
        )}
      </header>
      <main className="workspace-content">{children}</main>
    </div>
  );
}
