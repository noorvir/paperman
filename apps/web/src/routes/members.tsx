import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { getMembers } from "@/lib/auth/functions";
import { getCatalog } from "@/lib/queries";
import { MemberAccess } from "@/components/auth/member-access";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/members")({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).default(1),
    user: z.string().default(""),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [members, catalog] = await Promise.all([
      getMembers({ data: { offset: (deps.page - 1) * 25, userId: deps.user } }),
      getCatalog(),
    ]);
    return { ...members, catalog };
  },
  component: Members,
});

function Members() {
  const { members, total, selected, catalog } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <div className="workspace-page max-w-5xl">
      <PageHeader
        title="Members"
        description="Manage organization roles and linked owners."
        count={total}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="workspace-section min-w-0">
          {members.map((member) => (
            <Link
              key={member.id}
              to="/members"
              search={{ ...search, user: member.userId }}
              className="flex items-center justify-between gap-4 border-b p-3 text-xs hover:bg-accent"
              aria-current={search.user === member.userId ? "page" : undefined}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {member.user.name}
                </span>
                <span className="block truncate text-muted-foreground">
                  {member.user.email}
                </span>
              </span>
              <span>{member.role === "admin" ? "Admin" : "Member"}</span>
            </Link>
          ))}
          <div className="flex items-center justify-between text-xs">
            <span>{total} members</span>
            <div className="flex gap-2">
              {search.page > 1 && (
                <Link
                  to="/members"
                  search={{ ...search, page: search.page - 1 }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Previous
                </Link>
              )}
              {search.page * 25 < total && (
                <Link
                  to="/members"
                  search={{ ...search, page: search.page + 1 }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </section>
        {selected ? (
          <MemberAccess
            key={selected.member.id}
            selected={selected}
            owners={catalog.owners}
          />
        ) : (
          <p className="workspace-description">
            Select a member to manage access.
          </p>
        )}
      </div>
    </div>
  );
}
