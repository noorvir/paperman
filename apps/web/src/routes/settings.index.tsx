import { createFileRoute } from "@tanstack/react-router";
import { getSettings } from "@/lib/queries";
import { PageHeader, ActionButton } from "@/components/page";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { rebuildIndex } from "@/lib/actions";

export const Route = createFileRoute("/settings/")({
  loader: () => getSettings(),
  component: Settings,
});
function Settings() {
  const settings = Route.useLoaderData();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage people, labels, and document processing."
      />
      <SettingsNav active="processing" />
      <SettingsForm settings={settings} />
      <section className="workspace-section border-t pt-5">
        <h2 className="workspace-title">Search index</h2>
        <p className="workspace-description">
          Rebuild search from the document text and metadata files.
        </p>
        <div>
          <ActionButton action={() => rebuildIndex()}>
            Rebuild search index
          </ActionButton>
        </div>
      </section>
    </>
  );
}
