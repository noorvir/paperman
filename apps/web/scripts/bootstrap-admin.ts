import { getAuth } from "../src/lib/auth/auth.server";
import { migrateInstallation } from "../src/lib/auth/installation.server";

const runtime = await getAuth();
if (!runtime)
  throw new Error("Enable authentication before creating an administrator");
try {
  const { adapter } = await runtime.auth.$context;
  if (await adapter.findOne({ model: "user", where: [] })) {
    throw new Error(
      "Bootstrap is closed because accounts already exist. Use a superadmin account to manage users.",
    );
  }
  const email = process.env.PAPERMAN_BOOTSTRAP_EMAIL;
  const name = process.env.PAPERMAN_BOOTSTRAP_NAME;
  const password = process.env.PAPERMAN_BOOTSTRAP_PASSWORD;
  if (!email || !name || !password) {
    throw new Error(
      "Set PAPERMAN_BOOTSTRAP_EMAIL, PAPERMAN_BOOTSTRAP_NAME, and PAPERMAN_BOOTSTRAP_PASSWORD",
    );
  }
  await runtime.auth.api.createUser({
    body: { email, name, password, role: "superadmin" },
  });
  await migrateInstallation(runtime, email);
  console.info(
    "Superadmin and organization admin created. Sign in to manage PaperMan.",
  );
} finally {
  runtime.db.close();
}
