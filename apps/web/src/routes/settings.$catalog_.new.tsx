import { createFileRoute } from "@tanstack/react-router";
import { catalogKind } from "@/lib/queries";
import { CatalogForm } from "@/components/catalog-form";
export const Route = createFileRoute("/settings/$catalog_/new")({
  loader: ({ params }) => catalogKind.parse(params.catalog),
  component: NewEntry,
});
function NewEntry() {
  return <CatalogForm kind={Route.useLoaderData()} entry={null} />;
}
