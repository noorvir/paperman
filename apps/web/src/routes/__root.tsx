import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { EmptyState } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSettings } from "@/lib/queries";
import styles from "@/style.css?url";

export const Route = createRootRoute({
  loader: () => getSettings(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PaperMan" },
    ],
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: Root,
  notFoundComponent: () => (
    <div className="workspace-section items-center">
      <EmptyState
        title="Page not found"
        description="This page does not exist. Return to the overview to continue."
      />
      <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
        Return to overview
      </Link>
    </div>
  ),
});
function Root() {
  const settings = Route.useLoaderData();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          <WorkspaceLayout demo={settings.provider === "demo"}>
            <Outlet />
          </WorkspaceLayout>
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
