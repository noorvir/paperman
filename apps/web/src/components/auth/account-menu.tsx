import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserCircleIcon,
  UserShield01Icon,
  UserGroupIcon,
  LockPasswordIcon,
  Settings01Icon,
  LogoutSquare01Icon,
} from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { setMode } from "@/lib/auth/functions";
import { canAdmin } from "@/lib/auth/access";
import { useAccess } from "./access-context";
import { Button } from "../ui/button";
import { OwnerAvatar } from "../collection";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

export function AccountMenu() {
  const access = useAccess();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (access.state !== "authenticated") {
    return null;
  }
  async function change(action: () => Promise<unknown>, location: string) {
    setPending(true);
    setError("");
    try {
      await action();
      window.location.assign(location);
    } catch {
      setError("Could not update your session. Try again.");
      setPending(false);
    }
  }
  return (
    <div className="min-w-0 shrink-0">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    loading={pending}
                    className="rounded-full"
                    aria-label={`Account menu — ${access.mode === "admin" ? "Admin mode" : "Personal mode"}`}
                  />
                }
              />
            }
          >
            <OwnerAvatar
              name={access.name}
              className={
                access.mode === "admin"
                  ? "ring-[1.5px] ring-destructive"
                  : undefined
              }
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {access.mode === "admin" ? "Admin mode" : "Personal mode"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64 [&_[role=menuitem]]:whitespace-nowrap">
          <div className="px-2 py-2">
            <p className="truncate text-xs font-medium">{access.name}</p>
            <p className="text-xs text-muted-foreground">
              {access.mode === "admin" ? "Admin mode" : "Personal mode"}
            </p>
          </div>
          <DropdownMenuSeparator />
          {access.role === "admin" && (
            <DropdownMenuItem
              onClick={() =>
                void change(
                  () =>
                    setMode({
                      data: access.mode === "admin" ? "personal" : "admin",
                    }),
                  "/",
                )
              }
            >
              <HugeiconsIcon icon={access.mode === "admin" ? UserCircleIcon : UserShield01Icon} aria-hidden="true" />
              {access.mode === "admin"
                ? "Switch to personal mode"
                : "Switch to admin mode"}
            </DropdownMenuItem>
          )}
          {canAdmin(access) && (
            <DropdownMenuItem render={<Link to="/users" />}>
              <HugeiconsIcon icon={UserGroupIcon} aria-hidden="true" />
              Manage users
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link to="/account" />}>
            <HugeiconsIcon icon={LockPasswordIcon} aria-hidden="true" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings" />}>
            <HugeiconsIcon icon={Settings01Icon} aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              void change(async () => {
                const result = await authClient.signOut();
                if (result.error) {
                  throw new Error(result.error.message);
                }
              }, "/login")
            }
          >
            <HugeiconsIcon icon={LogoutSquare01Icon} aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
