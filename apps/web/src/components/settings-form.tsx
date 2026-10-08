import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { saveSettings, settingsInput } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { SelectField } from "./select-field";
import { Spinner } from "./ui/spinner";

export function SettingsForm({
  settings,
}: {
  settings: components["schemas"]["ModelSettings-Output"];
}) {
  const [draft, setDraft] = useState(settings);
  const provider = draft.provider;
  const unsaved = useUnsavedChanges(JSON.stringify(draft));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const value = settingsInput.parse(draft);
      await saveSettings({ data: value });
      unsaved.markSaved();
      setSaved(true);
      await router.invalidate();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save settings",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="form-fields max-w-none"
      onSubmit={(event) => void submit(event)}
    >
      <UnsavedChangesDialog blocker={unsaved.blocker} />
      <h2 className="workspace-title">Display</h2>
      <label className="field-label max-w-xs">
        Time format
        <SelectField
          label="Time format"
          value={draft.time_format}
          items={[
            { value: "24h", label: "24-hour (21:30)" },
            { value: "12h", label: "12-hour (9:30 PM)" },
          ]}
          onValueChange={(value) =>
            setDraft({
              ...draft,
              time_format: settingsInput.shape.time_format.parse(value),
            })
          }
        />
      </label>
      <h2 className="workspace-title">Model connection</h2>
      <p className="workspace-description">
        Choose a local demo or connect a model server that accepts page images.
        Document images are sent only to the endpoint you set.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Server type
          <SelectField
            label="Server type"
            name="provider"
            value={provider}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                provider: settingsInput.shape.provider.parse(value),
              })
            }
            items={[
              { value: "compatible", label: "Compatible API" },
              { value: "ollama", label: "Ollama" },
              { value: "demo", label: "Demo (local sample responses)" },
            ]}
          />
        </label>
        <label className={`field-label ${provider === "demo" ? "hidden" : ""}`}>
          Reasoning
          <SelectField
            label="Reasoning"
            name="reasoning_effort"
            value={draft.reasoning_effort}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                reasoning_effort:
                  settingsInput.shape.reasoning_effort.parse(value),
              })
            }
            items={["default", "none", "low", "medium", "high"].map(
              (effort) => ({
                value: effort,
                label: effort,
              }),
            )}
          />
        </label>
      </div>
      {provider === "demo" && (
        <p className="rounded-md bg-muted p-3 text-xs leading-relaxed">
          Demo mode returns local sample results. No document content is sent to
          a model server.
        </p>
      )}
      <fieldset
        disabled={provider === "demo"}
        hidden={provider === "demo"}
        className="flex flex-col gap-5"
      >
        <label className="field-label">
          Endpoint URL
          <Input
            type="url"
            name="base_url"
            value={draft.base_url}
            onChange={(event) =>
              setDraft({ ...draft, base_url: event.target.value })
            }
            placeholder="http://gpu-host:11434/v1"
          />
        </label>
        <label className="field-label">
          Model name
          <Input
            name="model"
            value={draft.model}
            onChange={(event) =>
              setDraft({ ...draft, model: event.target.value })
            }
            placeholder="Model installed on your server"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Output format
            <SelectField
              label="Output format"
              name="output_mode"
              value={draft.output_mode}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  output_mode: settingsInput.shape.output_mode.parse(value),
                })
              }
              items={[
                { value: "prompted", label: "JSON in response" },
                { value: "native", label: "Native JSON schema" },
                { value: "tool", label: "Tool calling" },
              ]}
            />
          </label>
          <label className="field-label">
            Timeout (seconds)
            <Input
              type="number"
              min={5}
              max={1800}
              name="timeout_seconds"
              value={draft.timeout_seconds}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  timeout_seconds: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      </fieldset>
      <label className="field-label">
        OCR languages
        <Input
          name="ocr_languages"
          required
          value={draft.ocr_languages}
          onChange={(event) =>
            setDraft({ ...draft, ocr_languages: event.target.value })
          }
        />
        <span className="font-normal text-muted-foreground">
          Tesseract language codes, for example eng or deu+eng. Install the
          matching language data on the worker.
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          name="review_before_filing"
          checked={draft.review_before_filing}
          onCheckedChange={(review_before_filing) =>
            setDraft({ ...draft, review_before_filing })
          }
        />
        Review all scans before filing
      </label>
      <p className="workspace-description">
        Clear scans are filed automatically when this is off. Uncertain page
        groups or details still need review. A clearly absent owner or date can
        use Unknown or the scan date.
      </p>
      <ErrorNotice message={error} />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          aria-label="Save settings"
          className="grid"
        >
          <span
            className={`col-start-1 row-start-1 ${pending ? "invisible" : ""}`}
          >
            Save settings
          </span>
          {pending && (
            <Spinner className="col-start-1 row-start-1 justify-self-center" />
          )}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            Settings saved
          </span>
        )}
      </div>
    </form>
  );
}
