import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { accountRoles, organizationRoles } from "./permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({ roles: accountRoles }),
    organizationClient({ roles: organizationRoles }),
  ],
});
