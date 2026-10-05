import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/navigation-preview")({
  beforeLoad: () => {
    throw redirect({ to: "/scans" });
  },
});
