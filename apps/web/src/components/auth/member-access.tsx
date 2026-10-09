import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { saveMember, type getMembers } from "@/lib/auth/functions";
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
import { ErrorNotice } from "../page";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "../unsaved-changes-dialog";

export function MemberAccess({
  selected,
  owners,
}: {
  selected: NonNullable<Awaited<ReturnType<typeof getMembers>>["selected"]>;
  owners: components["schemas"]["Catalog"]["owners"];
}) {
  const { member, ownerIds } = selected;
  const [draft, setDraft] = useState(ownerIds);
  const [role, setRole] = useState<"admin" | "member">(
    member.role === "admin" ? "admin" : "member",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const unsaved = useUnsavedChanges(
    JSON.stringify({ owners: [...draft].sort(), role }),
  );
  async function save() {
    setPending(true);
    setError("");
    try {
      await saveMember({
        data: { memberId: member.id, role, ownerIds: draft },
      });
      unsaved.markSaved();
      await router.invalidate();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update member",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="workspace-section min-w-0">
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <h2 className="workspace-title">{member.user.name}</h2>
      <p className="workspace-description break-words">{member.user.email}</p>
      <ErrorNotice message={error} />
      <label className="field-label">
        Organization role
        <Select
          value={role}
          disabled={pending}
          onValueChange={(value) => {
            if (value === "member" || value === "admin") setRole(value);
          }}
        >
          <SelectTrigger>
            <SelectValue>{role === "admin" ? "Admin" : "Member"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <p className="workspace-description">
        Admins can view shared scans, route documents, and manage organization
        settings and members.
      </p>
      <fieldset disabled={pending} className="space-y-2 border-t pt-4">
        <legend className="text-xs font-medium">Linked owners</legend>
        <p className="workspace-description">
          Routed documents for these owners are available to this member. One
          member can have multiple linked owners.
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
      </fieldset>
      <Button
        loading={pending}
        disabled={pending || !unsaved.isDirty}
        onClick={() => void save()}
      >
        Save owners and role
      </Button>
    </div>
  );
}
