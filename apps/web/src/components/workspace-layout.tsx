import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { useWorkspaceBreadcrumbs } from "@/hooks/use-workspace-breadcrumbs";
import { NavigationBreadcrumbs } from "./navigation-breadcrumbs";
import { buttonVariants } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function WorkspaceLayout({
  children,
  demo,
}: {
  children: ReactNode;
  demo: boolean;
}) {
  const breadcrumbs = useWorkspaceBreadcrumbs();
  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
      <header className="workspace-toolbar">
        <div className="workspace-toolbar-start">
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
          </nav>
        </div>
        {breadcrumbs.length > 0 && (
          <div className="workspace-toolbar-breadcrumbs">
            <NavigationBreadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div className="workspace-toolbar-end">
          {demo && (
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
              Demo workspace
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  to="/settings"
                  aria-label="Settings"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon",
                    className:
                      "text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground",
                  })}
                />
              }
            >
              <HugeiconsIcon icon={Settings01Icon} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <main className="workspace-content">{children}</main>
    </div>
  );
}
