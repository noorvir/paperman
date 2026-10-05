import { createFileRoute, redirect } from "@tanstack/react-router";
import { documentSearch } from "@/lib/queries";

export const Route = createFileRoute("/documents-test")({
  validateSearch: documentSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/documents", search, replace: true });
  },
});
