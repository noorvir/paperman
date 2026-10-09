import { Pen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTagIcon } from "@/lib/catalog-icons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { catalogKind, getCatalog } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/page";
import { SettingsNav } from "@/components/settings-nav";
import { buttonVariants } from "@/components/ui/button";
import { OwnerLabel } from "@/components/collection";
import { Badge } from "@/components/ui/badge";
import { RemoveCatalogEntry } from "@/components/remove-catalog-entry";
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
    return {
      kind,
      entries: [...catalog[kind]].sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }),
      ),
    };
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
      <div className="w-full">
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
                      <Badge variant="secondary">
                        <HugeiconsIcon
                          icon={getTagIcon(entry)}
                          size={14}
                          aria-hidden="true"
                        />
                        {entry.name}
                      </Badge>
                    )}
                  </TableCell>
                  {kind === "owners" && (
                    <TableCell>{entry.aliases.join(", ") || "—"}</TableCell>
                  )}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Link
                        to="/settings/$catalog/$entryId/edit"
                        params={{ catalog: kind, entryId: entry.id }}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        aria-label={`Edit ${entry.name}`}
                        title={`Edit ${entry.name}`}
                      >
                        <HugeiconsIcon icon={Pen01Icon} aria-hidden="true" />
                      </Link>
                      {(kind === "tags" || entry.id !== "unknown") && (
                        <RemoveCatalogEntry kind={kind} entry={entry} owners={entries} />
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
