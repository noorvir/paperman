import { createContext, useContext } from "react";
import type { Access } from "@/lib/auth/access";

export const AccessContext = createContext<Access>({ state: "disabled" });
export const useAccess = () => useContext(AccessContext);
