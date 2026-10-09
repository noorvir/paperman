import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { getUsers } from "@/lib/auth/functions";
import { getCatalog } from "@/lib/queries";
import { CreateUser } from "@/components/auth/create-user";
import { UserAccess } from "@/components/auth/user-access";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/users")({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).default(1),
    user: z.string().default(""),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [users, catalog] = await Promise.all([
      getUsers({ data: { offset: (deps.page - 1) * 25, userId: deps.user } }),
      getCatalog(),
    ]);
    return { ...users, catalog };
  },
  component: Users,
});

function Users() {
  const { users, total, selected, catalog } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <div className="workspace-page max-w-5xl">
      <PageHeader
        title="Users"
        description="Manage accounts, linked owners, and sessions."
        count={total}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="workspace-section min-w-0">
          {users.map((user) => (
            <Link
              key={user.id}
              to="/users"
              search={{ ...search, user: user.id }}
              className="flex items-center justify-between gap-4 border-b p-3 text-xs hover:bg-accent"
              aria-current={search.user === user.id ? "page" : undefined}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{user.name}</span>
                <span className="block truncate text-muted-foreground">
                  {user.email}
                </span>
              </span>
              <span>
                {user.banned
                  ? "Suspended"
                  : user.role === "admin"
                    ? "Admin"
                    : "User"}
              </span>
            </Link>
          ))}
          <div className="flex items-center justify-between text-xs">
            <span>{total} users</span>
            <div className="flex gap-2">
              {search.page > 1 && (
                <Link
                  to="/users"
                  search={{ ...search, page: search.page - 1 }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Previous
                </Link>
              )}
              {search.page * 25 < total && (
                <Link
                  to="/users"
                  search={{ ...search, page: search.page + 1 }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
          <CreateUser />
        </section>
        {selected ? (
          <UserAccess
            key={selected.user.id}
            selected={selected}
            owners={catalog.owners}
          />
        ) : (
          <p className="workspace-description">
            Select a user to manage access.
          </p>
        )}
      </div>
    </div>
  );
}
