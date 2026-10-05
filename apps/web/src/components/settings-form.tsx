import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import type { components } from "@/lib/schema";
import { saveSettings, settingsInput } from "@/lib/actions";
import { ErrorNotice } from "./page";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { SelectField } from "./select-field";

export function SettingsForm({
  settings,
}: {
  settings: components["schemas"]["ModelSettings-Output"];
}) {
  const [provider, setProvider] = useState(settings.provider);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const value = settingsInput.parse({
        provider: form.get("provider"),
        reasoning_effort: form.get("reasoning_effort"),
        base_url: form.get("base_url") ?? settings.base_url,
        model: form.get("model") ?? settings.model,
        timeout_seconds: Number(
          form.get("timeout_seconds") ?? settings.timeout_seconds,
        ),
        output_mode: form.get("output_mode") ?? settings.output_mode,
        ocr_languages: form.get("ocr_languages"),
        review_before_filing: form.has("review_before_filing"),
      });
      await saveSettings({ data: value });
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
              setProvider(settingsInput.shape.provider.parse(value))
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
            defaultValue={settings.reasoning_effort}
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
            defaultValue={settings.base_url}
            placeholder="http://gpu-host:11434/v1"
          />
        </label>
        <label className="field-label">
          Model name
          <Input
            name="model"
            defaultValue={settings.model}
            placeholder="Model installed on your server"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Output format
            <SelectField
              label="Output format"
              name="output_mode"
              defaultValue={settings.output_mode}
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
              defaultValue={settings.timeout_seconds}
            />
          </label>
        </div>
      </fieldset>
      <label className="field-label">
        OCR languages
        <Input
          name="ocr_languages"
          required
          defaultValue={settings.ocr_languages}
        />
        <span className="font-normal text-muted-foreground">
          Tesseract language codes, for example eng or deu+eng. Install the
          matching language data on the worker.
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          name="review_before_filing"
          defaultChecked={settings.review_before_filing}
        />
        Review all scans before filing
      </label>
      <p className="workspace-description">
        Uncertain groups and unknown owners always need review.
      </p>
      <ErrorNotice message={error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save settings"}
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
