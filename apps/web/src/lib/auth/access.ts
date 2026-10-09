import { z } from "zod";

export const accessSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("disabled") }),
  z.object({ state: z.literal("anonymous") }),
  z.object({
    state: z.literal("authenticated"),
    userId: z.string(),
    name: z.string(),
    role: z.enum(["user", "admin"]),
    mode: z.enum(["personal", "admin"]),
  }),
]);
export type Access = z.infer<typeof accessSchema>;

export function canAdmin(access: Access) {
  return (
    access.state === "disabled" ||
    (access.state === "authenticated" &&
      access.role === "admin" &&
      access.mode === "admin")
  );
}
