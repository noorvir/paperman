import { getAuth } from "../src/lib/auth/auth.server";
import { migrateInstallation } from "../src/lib/auth/installation.server";

const email = process.argv[2];
if (!email) throw new Error("Provide the existing superadmin email address");
const runtime = await getAuth();
if (!runtime)
  throw new Error("Enable authentication before migrating accounts");
try {
  const result = await migrateInstallation(runtime, email);
  console.info(
    `Migrated ${result.accounts} accounts. Superadmin: ${result.superadmin}`,
  );
} finally {
  runtime.db.close();
}
