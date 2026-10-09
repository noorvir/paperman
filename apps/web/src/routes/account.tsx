import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, ErrorNotice } from "@/components/page";

export const Route = createFileRoute("/account")({ component: Account });
function Account() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div className="workspace-page max-w-xl">
      <PageHeader
        title="Change password"
        description="Other sessions will end when you change your password."
      />
      <form
        className="workspace-section"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setSaved(false);
          setError("");
          void authClient
            .changePassword({
              currentPassword,
              newPassword,
              revokeOtherSessions: true,
            })
            .then((result) => {
              if (result.error) {
                setError(result.error.message ?? "Could not change password");
              } else {
                setCurrent("");
                setNew("");
                setSaved(true);
              }
            })
            .catch(() => setError("Could not change password"))
            .finally(() => setPending(false));
        }}
      >
        <label className="field-label">
          Current password
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
        <label className="field-label">
          New password
          <Input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={newPassword}
            onChange={(event) => setNew(event.target.value)}
          />
        </label>
        <ErrorNotice message={error} />
        {saved && (
          <p role="status" className="text-xs">
            Password changed.
          </p>
        )}
        <Button type="submit" loading={pending}>
          Change password
        </Button>
      </form>
    </div>
  );
}
