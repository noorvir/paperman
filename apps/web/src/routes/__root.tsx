import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
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
    <div className="workspace-section">
      <h1>Page not found</h1>
      <a href="/">Return to overview</a>
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
