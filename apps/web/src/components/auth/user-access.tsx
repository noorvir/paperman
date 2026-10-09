import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { type getUsers } from "@/lib/auth/functions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ErrorNotice } from "../page";

export function UserAccess({
  selected,
}: {
  selected: NonNullable<Awaited<ReturnType<typeof getUsers>>["selected"]>;
}) {
  const { user, sessions } = selected;
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
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
      <ErrorNotice message={error} />
      <p className="workspace-description">
        {user.role === "superadmin" ? "Superadmin" : "User"}
      </p>
      {user.role !== "superadmin" && (
        <Button
          variant="outline"
          loading={pending === "impersonate"}
          disabled={Boolean(pending)}
          onClick={() =>
            void run("impersonate", async () => {
              const result = await authClient.admin.impersonateUser({
                userId: user.id,
              });
              if (result.error) throw new Error(result.error.message);
              window.location.assign("/");
            })
          }
        >
          Impersonate user
        </Button>
      )}
      <section className="workspace-section border-t pt-4">
        <h3 className="text-xs font-medium">User access</h3>
        <Button
          variant="outline"
          loading={pending === "suspend"}
          disabled={Boolean(pending) || user.role === "superadmin"}
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
          {user.banned ? "Restore user" : "Suspend user"}
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
