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
import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { changeGodMode } from "@/lib/auth/functions";
import { canAdmin, canSuperAdmin } from "@/lib/auth/access";
import { useAccess } from "./access-context";
import { Button } from "../ui/button";
import { OwnerAvatar } from "../collection";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

export function AccountMenu() {
  const access = useAccess();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (access.state !== "authenticated") {
    return null;
  }
  const roleLabel = [
    access.godMode
      ? "God mode"
      : access.applicationRole === "superadmin"
        ? "Superadmin"
        : null,
    access.organizationRole === "admin"
      ? "Organization admin"
      : access.organizationRole === "member"
        ? "Member"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  async function change(action: () => Promise<unknown>, location?: string) {
    setPending(true);
    setError("");
    try {
      await action();
      if (location) window.location.assign(location);
      else await router.invalidate();
    } catch {
      setError("Could not update your session. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2">
      {canSuperAdmin(access) && (
        <span className="text-xs text-destructive">God mode</span>
      )}
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
                    aria-label={`Account menu — ${roleLabel}`}
                  />
                }
              />
            }
          >
            <OwnerAvatar
              name={access.name}
              className={
                canSuperAdmin(access)
                  ? "ring-[1.5px] ring-destructive"
                  : undefined
              }
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">{roleLabel}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="w-64 [&_[role=menuitem]]:whitespace-nowrap"
        >
          <div className="px-2 py-2">
            <p className="truncate text-xs font-medium">{access.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <DropdownMenuSeparator />
          {access.applicationRole === "superadmin" && !access.impersonating && (
            <DropdownMenuCheckboxItem
              checked={access.godMode}
              disabled={pending}
              onCheckedChange={(checked) =>
                void change(() => changeGodMode({ data: checked }))
              }
            >
              <HugeiconsIcon icon={UserShield01Icon} aria-hidden="true" />
              God mode
            </DropdownMenuCheckboxItem>
          )}
          {access.impersonating && (
            <DropdownMenuItem
              onClick={() =>
                void change(async () => {
                  const result = await authClient.admin.stopImpersonating();
                  if (result.error) throw new Error(result.error.message);
                }, "/users")
              }
            >
              <HugeiconsIcon icon={UserCircleIcon} aria-hidden="true" />
              Stop impersonating
            </DropdownMenuItem>
          )}
          {canAdmin(access) && (
            <DropdownMenuItem render={<Link to="/members" />}>
              <HugeiconsIcon icon={UserGroupIcon} aria-hidden="true" />
              Manage members
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
