import { createFileRoute, Link } from "@tanstack/react-router";
import { catalogKind, getCatalog } from "@/lib/queries";
import { ActionButton, EmptyState, PageHeader } from "@/components/page";
import { SettingsNav } from "@/components/settings-nav";
import { buttonVariants } from "@/components/ui/button";
import { OwnerLabel } from "@/components/collection";
import { Badge } from "@/components/ui/badge";
import { deleteEntry } from "@/lib/actions";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/settings/$catalog")({
  loader: async ({ params }) => {
    const kind = catalogKind.parse(params.catalog);
    const catalog = await getCatalog();
    return { kind, entries: catalog[kind] };
  },
  component: Catalog,
});
function Catalog() {
  const { kind, entries } = Route.useLoaderData();
  const title = kind === "owners" ? "Owners" : "Tags";
  return (
    <>
      <PageHeader
        title={title}
        count={entries.length}
        description={
          kind === "owners"
            ? "People and companies that receive documents. Unknown is used when no owner matches."
            : "Labels available for document classification."
        }
      >
        <Link
          to="/settings/$catalog/new"
          params={{ catalog: kind }}
          className={buttonVariants()}
        >
          Add {kind === "owners" ? "owner" : "tag"}
        </Link>
      </PageHeader>
      <SettingsNav active={kind} />
      <div className="max-w-4xl">
        {entries.length === 0 ? (
          <EmptyState
            title={`No ${kind} yet`}
            description="Add an entry to the catalog."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {kind === "owners" && <TableHead>Aliases</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {kind === "owners" ? (
                      <OwnerLabel name={entry.name} />
                    ) : (
                      <Badge variant="secondary">{entry.name}</Badge>
                    )}
                  </TableCell>
                  {kind === "owners" && (
                    <TableCell>{entry.aliases.join(", ") || "—"}</TableCell>
                  )}
                  <TableCell>
                    <div className="flex justify-end gap-3">
                      <Link
                        to="/settings/$catalog/$entryId/edit"
                        params={{ catalog: kind, entryId: entry.id }}
                        className={buttonVariants({ variant: "ghost" })}
                      >
                        Edit
                      </Link>
                      {entry.id !== "unknown" && (
                        <ActionButton
                          action={() =>
                            deleteEntry({ data: { kind, id: entry.id } })
                          }
                        >
                          Remove
                        </ActionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
