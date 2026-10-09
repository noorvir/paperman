import { AccountMenu } from "./auth/account-menu";
import { useAccess } from "./auth/access-context";
import { canAdmin } from "@/lib/auth/access";
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
import { Button } from "./ui/button";
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
  const access = useAccess();
  const admin = canAdmin(access);
  const visiblePages = pages.filter(({ to }) => admin || to !== "/scans");
  const breadcrumbs = useWorkspaceBreadcrumbs();
  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
      <header
        className="workspace-toolbar"
        data-breadcrumbs={breadcrumbs.length > 0}
        data-authenticated={access.state === "authenticated"}
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
              {visiblePages.map(({ to, label }) => (
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
              {admin && <Link to="/settings">Settings</Link>}
            </nav>
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
                {visiblePages.map(({ to, label, icon }) => (
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
                {admin && (
                  <DropdownMenuItem render={<Link to="/settings" />}>
                    <HugeiconsIcon icon={Settings01Icon} aria-hidden="true" />
                    Settings
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <AccountMenu />
        </div>
      </header>
      <main className="workspace-content">{children}</main>
    </div>
  );
}
