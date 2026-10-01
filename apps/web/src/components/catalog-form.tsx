import { TagIconPicker } from "./tag-icon-picker";
import { BackLink } from "@/components/back-link";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { saveEntry } from "@/lib/actions";
import { ErrorNotice, PageHeader } from "./page";
import { Input } from "./ui/input";
import { Button, buttonVariants } from "./ui/button";

export function CatalogForm({
  kind,
  entry,
}: {
  kind: "owners" | "tags";
  entry: components["schemas"]["CatalogEntry"] | null;
}) {
  const [icon, setIcon] = useState(entry?.icon ?? "auto");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const name = String(form.get("name"));
      const aliases = String(form.get("aliases") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      await saveEntry({
        data: { kind, id: entry?.id ?? "", value: { name, aliases, icon } },
      });
      await router.invalidate({ sync: true });
      await navigate({ to: "/settings/$catalog", params: { catalog: kind } });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save this entry",
      );
    } finally {
      setPending(false);
    }
  }
  const name = kind === "owners" ? "owner" : "tag";
  return (
    <>
      <PageHeader
        back={
          <BackLink
            to="/settings/$catalog"
            params={{ catalog: kind }}
            aria-label={`Back to ${kind}`}
            title={`Back to ${kind}`}
          />
        }
        title={`${entry ? "Edit" : "Add"} ${name}`}
        description={
          kind === "owners"
            ? "Aliases help the model match names printed on mail."
            : "Use a short, clear label."
        }
      />
      <form
        className="form-fields max-w-none"
        onSubmit={(event) => void submit(event)}
      >
        <label className="field-label">
          Name
          <Input
            name="name"
            required
            maxLength={120}
            defaultValue={entry?.name ?? ""}
          />
        </label>
        {kind === "owners" && (
          <label className="field-label">
            Aliases, separated by commas
            <Input
              name="aliases"
              defaultValue={entry?.aliases.join(", ") ?? ""}
            />
          </label>
        )}
        {kind === "tags" && <TagIconPicker value={icon} onChange={setIcon} />}
        <ErrorNotice message={error} />
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save"}
          </Button>
          <Link
            to="/settings/$catalog"
            params={{ catalog: kind }}
            className={buttonVariants({ variant: "ghost" })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
