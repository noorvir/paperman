import {
  createRootRoute,
  redirect,
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
import { getWorkspace, getSessionAccess } from "@/lib/auth/functions";
import { canAdmin } from "@/lib/auth/access";
import { AccessContext } from "@/components/auth/access-context";
import "@/style.css";
import interFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const access = await getSessionAccess();
    if (access.state === "anonymous" && location.pathname !== "/login") {
      throw redirect({ to: "/login" });
    }
    if (access.state !== "anonymous" && location.pathname === "/login") {
      throw redirect({ to: "/" });
    }
    const adminPage = /^\/(scans|settings|users)(\/|$)/.test(location.pathname);
    if (adminPage && !canAdmin(access)) {
      throw redirect({ to: "/documents" });
    }
    if (
      access.state === "disabled" &&
      ["/users", "/account"].includes(location.pathname)
    ) {
      throw redirect({ to: "/" });
    }
    return { access };
  },
  loader: () => getWorkspace(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PaperMan" },
    ],
    links: [
      {
        rel: "preload",
        href: interFont,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
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
          <AccessContext value={settings.access}>
            {settings.access.state === "anonymous" ? (
              <Outlet />
            ) : (
              <WorkspaceLayout demo={settings.demo}>
                <Outlet />
              </WorkspaceLayout>
            )}
          </AccessContext>
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
