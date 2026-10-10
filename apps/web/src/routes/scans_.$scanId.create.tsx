import { createFileRoute } from "@tanstack/react-router";
import { persistedSearch } from "@/lib/search-preferences";
import { pdfSearch } from "@/lib/search";
import { getCatalog, getScanWithDocuments } from "@/lib/queries";
import { CreateDocument } from "@/components/create-document";

export const Route = createFileRoute("/scans_/$scanId/create")({
  ...persistedSearch(pdfSearch, {
    name: "pdf",
    schema: pdfSearch,
    retain: true,
  }),
  loader: async ({ params }) => {
    const [source, catalog] = await Promise.all([
      getScanWithDocuments({ data: params.scanId }),
      getCatalog(),
    ]);
    if (!source) throw new Error("This scan is not available to your account");
    return { ...source, catalog };
  },
  component: Create,
});
function Create() {
  const { scan, documents, catalog } = Route.useLoaderData();
  return (
    <CreateDocument
      key={scan.id}
      scan={scan}
      documents={documents}
      catalog={catalog}
    />
  );
}
