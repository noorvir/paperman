import { z } from "zod";
import type { getAuth } from "./auth.server";
import { installationId } from "./permissions";

type Runtime = NonNullable<Awaited<ReturnType<typeof getAuth>>>;

export async function migrateInstallation(
  runtime: Runtime,
  superadminEmail: string,
) {
  const { adapter } = await runtime.auth.$context;
  const users = z
    .array(
      z.object({
        id: z.string(),
        email: z.string(),
        role: z.string().nullish(),
      }),
    )
    .parse(await adapter.findMany({ model: "user", limit: 100_000 }));
  const superadmin = users.find(
    (user) => user.email.toLowerCase() === superadminEmail.toLowerCase(),
  );
  if (!superadmin) throw new Error("The superadmin account does not exist");
  const installation = await adapter.findOne({
    model: "organization",
    where: [{ field: "id", value: installationId }],
  });
  if (!installation) {
    await adapter.create({
      model: "organization",
      forceAllowId: true,
      data: {
        id: installationId,
        name: "PaperMan",
        slug: installationId,
        createdAt: new Date(),
      },
    });
  }
  for (const user of users) {
    const where = [
      { field: "organizationId", value: installationId },
      { field: "userId", value: user.id },
    ];
    const member = await adapter.findOne({ model: "member", where });
    if (!member) {
      await runtime.auth.api.addMember({
        body: {
          organizationId: installationId,
          userId: user.id,
          role:
            user.id === superadmin.id || user.role === "admin"
              ? "admin"
              : "member",
        },
      });
    }
    await adapter.update({
      model: "user",
      where: [{ field: "id", value: user.id }],
      update: { role: user.id === superadmin.id ? "superadmin" : "user" },
    });
  }
  return { accounts: users.length, superadmin: superadmin.email };
}
