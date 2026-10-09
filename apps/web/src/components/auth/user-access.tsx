import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { saveRoutingOwners, type getUsers } from "@/lib/auth/functions";
import type { components } from "@/lib/schema";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import { Input } from "../ui/input";
import { ErrorNotice } from "../page";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "../unsaved-changes-dialog";

export function UserAccess({
  selected,
  owners,
}: {
  selected: NonNullable<Awaited<ReturnType<typeof getUsers>>["selected"]>;
  owners: components["schemas"]["Catalog"]["owners"];
}) {
  const { user, sessions, ownerIds } = selected;
  const [draft, setDraft] = useState(() =>
    ownerIds.filter((id) => owners.some((owner) => owner.id === id)),
  );
  const [role, setRole] = useState(user.role === "admin" ? "admin" : "user");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const unsaved = useUnsavedChanges(
    JSON.stringify({ owners: [...draft].sort(), role }),
  );
  async function run(label: string, action: () => Promise<unknown>) {
    setPending(label);
    setError("");
    try {
      await action();
      await router.invalidate();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update user",
      );
    } finally {
      setPending("");
    }
  }
  return (
    <div className="workspace-section min-w-0">
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <h2 className="workspace-title">{user.name}</h2>
      <p className="workspace-description break-words">{user.email}</p>
      <ErrorNotice message={error} />
      <label className="field-label">
        Role
        <Select
          value={role}
          disabled={Boolean(pending)}
          onValueChange={(value) => {
            if (value === "user" || value === "admin") {
              setRole(value);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue>{role === "admin" ? "Admin" : "User"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <fieldset disabled={Boolean(pending)} className="space-y-2 border-t pt-4">
        <legend className="text-xs font-medium">Shared-mail routing</legend>
        <p className="workspace-description">
          These owners suggest this account as a recipient for shared mail. An
          admin must confirm delivery. These settings do not change access to
          existing documents.
        </p>
        {owners
          .filter((owner) => owner.id !== "unknown")
          .map((owner) => (
            <label key={owner.id} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={draft.includes(owner.id)}
                onCheckedChange={(checked) =>
                  setDraft(
                    checked
                      ? [...draft, owner.id]
                      : draft.filter((id) => id !== owner.id),
                  )
                }
              />
              {owner.name}
            </label>
          ))}
        <Button
          loading={pending === "owners"}
          disabled={Boolean(pending) || !unsaved.isDirty}
          onClick={() =>
            void run("owners", async () => {
              await saveRoutingOwners({
                data: { userId: user.id, ownerIds: draft },
              });
              if ((role === "admin" || role === "user") && role !== user.role) {
                const result = await authClient.admin.setRole({
                  userId: user.id,
                  role,
                });
                if (result.error) {
                  throw new Error(result.error.message);
                }
              }
              unsaved.markSaved();
            })
          }
        >
          Save routing and role
        </Button>
      </fieldset>
      <section className="workspace-section border-t pt-4">
        <h3 className="text-xs font-medium">Account access</h3>
        <Button
          variant="outline"
          loading={pending === "suspend"}
          disabled={Boolean(pending)}
          onClick={() =>
            void run("suspend", async () => {
              const result = user.banned
                ? await authClient.admin.unbanUser({ userId: user.id })
                : await authClient.admin.banUser({
                    userId: user.id,
                    banReason: "Suspended by administrator",
                  });
              if (result.error) {
                throw new Error(result.error.message);
              }
            })
          }
        >
          {user.banned ? "Restore account" : "Suspend account"}
        </Button>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run("password", async () => {
              const result = await authClient.admin.setUserPassword({
                userId: user.id,
                newPassword: password,
              });
              if (result.error) {
                throw new Error(result.error.message);
              }
              const revoked = await authClient.admin.revokeUserSessions({
                userId: user.id,
              });
              if (revoked.error) {
                throw new Error(revoked.error.message);
              }
              setPassword("");
            });
          }}
        >
          <label className="field-label">
            New password
            <Input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            loading={pending === "password"}
            disabled={Boolean(pending)}
          >
            Reset password and end sessions
          </Button>
        </form>
      </section>
      <section className="workspace-section border-t pt-4">
        <h3 className="text-xs font-medium">
          Active sessions ({sessions.length})
        </h3>
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="min-w-0 truncate" title={session.userAgent ?? ""}>
              {session.userAgent || "Unknown device"}
            </span>
            <Button
              variant="link"
              loading={pending === session.id}
              disabled={Boolean(pending)}
              onClick={() =>
                void run(session.id, async () => {
                  const result = await authClient.admin.revokeUserSession({
                    sessionToken: session.token,
                  });
                  if (result.error) {
                    throw new Error(result.error.message);
                  }
                })
              }
            >
              End session
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
