import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { savePreferences } from "@/lib/actions";
import { Button, buttonVariants } from "./ui/button";
import { SelectField } from "./select-field";
import { ErrorNotice } from "./page";

export function PersonalSettings({
  timeFormat,
  inboxes,
}: {
  timeFormat: "12h" | "24h";
  inboxes: components["schemas"]["Inbox"][];
}) {
  const [format, setFormat] = useState(timeFormat);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div className="workspace-section max-w-xl">
      <section className="space-y-3">
        <h2 className="workspace-title">Your account</h2>
        <Link
          to="/account"
          className={buttonVariants({ variant: "link", className: "px-0" })}
        >
          Change password
        </Link>
      </section>
      <form
        className="space-y-3 border-t pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          void savePreferences({ data: { time_format: format } })
            .then(async () => {
              await router.invalidate();
            })
            .catch((error: unknown) => {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save preferences",
              );
            })
            .finally(() => setPending(false));
        }}
      >
        <h2 className="workspace-title">Display</h2>
        <SelectField
          label="Time format"
          value={format}
          items={[
            { value: "24h", label: "24-hour (21:30)" },
            { value: "12h", label: "12-hour (9:30 PM)" },
          ]}
          onValueChange={(value) => {
            if (value === "24h" || value === "12h") setFormat(value);
          }}
        />
        <ErrorNotice message={error} />
        <Button
          loading={pending}
          disabled={pending || format === timeFormat}
          type="submit"
        >
          Save preferences
        </Button>
      </form>
      <section className="space-y-3 border-t pt-4">
        <h2 className="workspace-title">Your inbox</h2>
        <p className="workspace-description">
          Uploads to your personal inbox stay private. You can share individual
          documents after processing.
        </p>
        {inboxes.map((inbox) => (
          <p className="text-xs" key={inbox.id}>
            {inbox.name}
          </p>
        ))}
        <Link
          to="/scans/upload"
          className={buttonVariants({ variant: "outline" })}
        >
          Upload scan
        </Link>
      </section>
    </div>
  );
}
