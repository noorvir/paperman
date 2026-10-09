import { canAdmin } from "@/lib/auth/access";
import { getWorkspace } from "@/lib/auth/functions";
import { PersonalSettings } from "@/components/personal-settings";
import { createFileRoute } from "@tanstack/react-router";
import { getSettings, getDashboard, getInboxes } from "@/lib/queries";
import { PageHeader, ActionButton } from "@/components/page";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsForm } from "@/components/settings-form";
import { rebuildIndex } from "@/lib/actions";

export const Route = createFileRoute("/settings/")({
  loader: async ({ context }) => {
    if (!canAdmin(context.access)) {
      const [workspace, inboxes] = await Promise.all([
        getWorkspace(),
        getInboxes(),
      ]);
      return {
        settings: null,
        inboxPath: "",
        personal: { workspace, inboxes },
      };
    }
    const [settings, dashboard] = await Promise.all([
      getSettings(),
      getDashboard({ data: { page: 1 } }),
    ]);
    return { settings, inboxPath: dashboard.inbox_path, personal: null };
  },
  component: Settings,
});
function Settings() {
  const { settings, inboxPath, personal } = Route.useLoaderData();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage people, labels, and document processing."
      />
      <SettingsNav active="processing" />
      {personal && (
        <PersonalSettings
          timeFormat={personal.workspace.time_format}
          inboxes={personal.inboxes}
        />
      )}
      {settings && (
        <>
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
      )}
    </>
  );
}
