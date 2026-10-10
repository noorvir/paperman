import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { getUsers } from "@/lib/auth/functions";
import { CreateUser } from "@/components/auth/create-user";
import { UserAccess } from "@/components/auth/user-access";
import { PageHeader } from "@/components/page";
import { CollectionFooter } from "@/components/collection";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/users")({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).default(1),
    user: z.string().default(""),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) =>
    getUsers({
      data: { offset: (deps.page - 1) * 25, userId: deps.user },
    }),
  component: Users,
});

function Users() {
  const { users, total, selected } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div className="collection-workspace">
      <PageHeader
        title="Users"
        description="Manage users and sessions."
        count={total}
      >
        <CreateUser />
      </PageHeader>
      <section className="collection">
        <div className="collection-content">
          <div className="collection-body">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-32">Role</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="whitespace-normal break-words font-medium">
                      {user.name}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.role === "superadmin" ? "Superadmin" : "User"}
                    </TableCell>
                    <TableCell>
                      {user.banned ? "Suspended" : "Active"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/users"
                        search={{ ...search, user: user.id }}
                        resetScroll={false}
                        aria-label={`Manage ${user.name}`}
                        className={buttonVariants({ variant: "ghost" })}
                      >
                        Manage
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <CollectionFooter
          page={search.page}
          pages={pages}
          total={total}
          count={users.length}
          noun="users"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={search.page <= 1}
            onClick={() =>
              void navigate({ search: { page: search.page - 1, user: "" } })
            }
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={search.page >= pages}
            onClick={() =>
              void navigate({ search: { page: search.page + 1, user: "" } })
            }
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </CollectionFooter>
      </section>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open)
            void navigate({
              search: { ...search, user: "" },
              resetScroll: false,
            });
        }}
      >
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.user.name}</DialogTitle>
              <DialogDescription>{selected.user.email}</DialogDescription>
            </DialogHeader>
            <UserAccess key={selected.user.id} selected={selected} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
