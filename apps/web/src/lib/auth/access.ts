import { z } from "zod";

export const accessSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("disabled") }),
  z.object({ state: z.literal("anonymous") }),
  z.object({
    state: z.literal("authenticated"),
    userId: z.string(),
    name: z.string(),
    applicationRole: z.enum(["user", "superadmin"]),
    organizationRole: z.enum(["member", "admin"]).nullable(),
    impersonating: z.boolean(),
    godMode: z.boolean(),
  }),
]);
export type Access = z.infer<typeof accessSchema>;

export function canAdmin(access: Access) {
  return (
    access.state === "disabled" ||
    (access.state === "authenticated" && access.organizationRole === "admin")
  );
}

export function canSuperAdmin(access: Access) {
  return (
    access.state === "authenticated" &&
    access.applicationRole === "superadmin" &&
    access.godMode &&
    !access.impersonating
  );
}
