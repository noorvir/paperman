import { getAuth } from "../src/lib/auth/auth.server";

const runtime = await getAuth();
if (!runtime) {
  throw new Error("Enable authentication before creating an administrator");
}
if (runtime.db.prepare("SELECT id FROM user LIMIT 1").get()) {
  throw new Error(
    "Bootstrap is closed because accounts already exist. Use an admin account to manage users.",
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
  body: { email, name, password, role: "admin" },
});
console.info(
  "Administrator created. Sign in and switch to admin mode to manage users and deliver shared documents.",
);
runtime.db.close();
