import type { ComponentProps, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  DashboardSquare01Icon,
  Menu01Icon,
  ScanIcon,
  ListViewIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { useWorkspaceBreadcrumbs } from "@/hooks/use-workspace-breadcrumbs";
import { NavigationBreadcrumbs } from "./navigation-breadcrumbs";
import { Button, buttonVariants } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const pages: {
  to: "/" | "/documents" | "/scans";
  label: string;
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
}[] = [
  { to: "/", label: "Overview", icon: DashboardSquare01Icon },
  { to: "/documents", label: "Documents", icon: File01Icon },
  { to: "/scans", label: "Scans", icon: ScanIcon },
];

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
      <header
        className="workspace-toolbar"
        data-breadcrumbs={breadcrumbs.length > 0}
      >
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
            <div className="workspace-nav-tabs">
              {pages.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  search={{}}
                  activeOptions={{ exact: to === "/" }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
        {breadcrumbs.length > 0 && (
          <div className="workspace-toolbar-breadcrumbs">
            <NavigationBreadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div className="workspace-toolbar-end">
          <div className="workspace-toolbar-controls">
            {demo && (
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                Demo workspace
              </span>
            )}
            <nav
              aria-label="Additional navigation"
              className="workspace-nav-tabs"
            >
              <Link to="/roadmap">Roadmap</Link>
            </nav>
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
          <div className="workspace-nav-menu">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                  />
                }
                aria-label="Main navigation menu"
              >
                <HugeiconsIcon icon={Menu01Icon} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pages.map(({ to, label, icon }) => (
                  <DropdownMenuItem
                    key={to}
                    render={
                      <Link
                        to={to}
                        search={{}}
                        activeOptions={{ exact: to === "/" }}
                      />
                    }
                  >
                    <HugeiconsIcon icon={icon} aria-hidden="true" />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/roadmap" />}>
                  <HugeiconsIcon icon={ListViewIcon} aria-hidden="true" />
                  Roadmap
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/settings" />}>
                  <HugeiconsIcon icon={Settings01Icon} aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="workspace-content">{children}</main>
    </div>
  );
}
