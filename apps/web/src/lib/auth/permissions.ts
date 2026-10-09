import { adminAc, userAc } from "better-auth/plugins/admin/access";
import {
  adminAc as organizationAdmin,
  memberAc,
} from "better-auth/plugins/organization/access";

export const installationId = "paperman";
export const accountRoles = { superadmin: adminAc, user: userAc };
export const organizationRoles = { admin: organizationAdmin, member: memberAc };
