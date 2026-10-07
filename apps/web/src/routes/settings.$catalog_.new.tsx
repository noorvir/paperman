import { createFileRoute } from "@tanstack/react-router";
import { catalogKind } from "@/lib/queries";
import { CatalogForm } from "@/components/catalog-form";
export const Route = createFileRoute("/settings/$catalog_/new")({
  loader: ({ params }) => catalogKind.parse(params.catalog),
  component: NewEntry,
});
function NewEntry() {
  const kind = Route.useLoaderData();
  return <CatalogForm key={kind} kind={kind} entry={null} />;
}
