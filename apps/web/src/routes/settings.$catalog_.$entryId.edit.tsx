import { createFileRoute, notFound } from "@tanstack/react-router";
import { catalogKind, getCatalog } from "@/lib/queries";
import { CatalogForm } from "@/components/catalog-form";
export const Route = createFileRoute("/settings/$catalog_/$entryId/edit")({
  loader: async ({ params }) => {
    const kind = catalogKind.parse(params.catalog);
    const catalog = await getCatalog();
    const entry = catalog[kind].find((entry) => entry.id === params.entryId);
    if (!entry) throw notFound();
    return { kind, entry };
  },
  component: EditEntry,
});
function EditEntry() {
  const { kind, entry } = Route.useLoaderData();
  return <CatalogForm kind={kind} entry={entry} />;
}
