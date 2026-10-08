import { createFileRoute } from "@tanstack/react-router";
import { getSettings, getDashboard } from "@/lib/queries";
import { PageHeader, ActionButton } from "@/components/page";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { rebuildIndex } from "@/lib/actions";

export const Route = createFileRoute("/settings/")({
  loader: async () => {
    const [settings, dashboard] = await Promise.all([
      getSettings(),
      getDashboard({ data: { page: 1 } }),
    ]);
    return { settings, inboxPath: dashboard.inbox_path };
  },
  component: Settings,
});
function Settings() {
  const { settings, inboxPath } = Route.useLoaderData();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage people, labels, and document processing."
      />
      <SettingsNav active="processing" />
      <SettingsForm settings={settings} />
      <section className="workspace-section border-t pt-5">
        <h2 className="workspace-title">Inbox location</h2>
        <p className="workspace-description">
          New PDFs in this folder are processed automatically.
        </p>
        <code className="break-all text-xs">{inboxPath}</code>
      </section>
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
