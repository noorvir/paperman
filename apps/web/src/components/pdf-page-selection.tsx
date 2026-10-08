import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function PdfPageSelection({
  page,
  position,
  count,
  disabled,
  onToggle,
  onMove,
}: {
  page: number;
  position: number;
  count: number;
  disabled: boolean;
  onToggle: (page: number) => void;
  onMove: (page: number, position: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft !== null && /^\d+$/.test(draft)) {
      const next = Math.max(1, Math.min(count, Number(draft)));
      if (next !== position) {
        onMove(page, next);
      }
    }
    setDraft(null);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-10 h-full w-full rounded-none p-0 hover:bg-transparent hover:ring-2 hover:ring-ring active:not-aria-[haspopup]:translate-y-0"
        aria-label={`Include page ${page}`}
        aria-pressed={position > 0}
        disabled={disabled}
        onClick={() => onToggle(page)}
      />
      {position > 0 && (
        <Input
          variant="info"
          aria-label={`Position for scan page ${page}`}
          title="Page position in document"
          inputMode="numeric"
          value={draft ?? String(position)}
          disabled={disabled}
          className="absolute top-3 right-3 z-20 size-9 rounded-full border p-0 text-center text-sm font-semibold md:text-sm"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDraft(null);
            }
          }}
        />
      )}
    </>
  );
}
