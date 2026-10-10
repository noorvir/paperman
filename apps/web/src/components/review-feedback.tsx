import { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ErrorNotice } from "./page";

export function ReviewFeedback({
  instructions,
  onInstructionsChange,
  disabled,
  onRevise,
  onUndo,
}: {
  instructions: string;
  onInstructionsChange: (value: string) => void;
  disabled: boolean;
  onRevise: (instructions: string) => Promise<void>;
  onUndo?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function revise() {
    if (disabled || !instructions.trim()) {
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onRevise(instructions.trim());
      setMessage("Proposal updated. Check the changes before you approve.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update the proposal",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="workspace-section" aria-label="Review feedback">
      <label className="field-label">
        Describe changes
        <Textarea
          value={instructions}
          disabled={disabled}
          maxLength={4000}
          rows={3}
          placeholder="For example: Keep pages 1–4 together. Page 5 starts a new document. Assign both to Sam."
          onChange={(event) => onInstructionsChange(event.target.value)}
        />
      </label>
      <p className="workspace-description">
        Ask the model to change page groups, owners, the Created by field,
        titles, dates, or blank pages. Changes stay in this form until you
        approve them.
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={disabled || !instructions.trim()}
          loading={pending}
          onClick={() => void revise()}
        >
          Update proposal
        </Button>
        {onUndo && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              onUndo();
              setMessage("Previous proposal restored.");
            }}
          >
            Undo
          </Button>
        )}
      </div>
      <p role="status" className="min-h-5 text-xs text-muted-foreground">
        {pending ? "Updating proposal" : message}
      </p>
      <ErrorNotice message={error} />
    </section>
  );
}
