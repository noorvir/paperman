import type { components } from "@/lib/schema";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

type Creators = NonNullable<
  components["schemas"]["Scan"]["proposal"]
>["documents"][number]["creators"];

export function CreatorProposalEditor({
  value,
  onChange,
}: {
  value: Creators;
  onChange: (value: Creators) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-medium">Created by</legend>
      {value.length ? (
        value.map((creator, position) => (
          <div key={position} className="flex items-center gap-2">
            <Input
              aria-label={`Created by ${position + 1}`}
              value={creator.name}
              required
              maxLength={120}
              onChange={(event) =>
                onChange(
                  value.map((item, index) =>
                    index === position
                      ? {
                          catalog_id: null,
                          name: event.target.value,
                          aliases: [],
                        }
                      : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove name ${position + 1}`}
              onClick={() =>
                onChange(value.filter((_, index) => index !== position))
              }
            >
              Remove
            </Button>
          </div>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">None identified</p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([...value, { catalog_id: null, name: "", aliases: [] }])
        }
      >
        Add person or organization
      </Button>
    </fieldset>
  );
}
