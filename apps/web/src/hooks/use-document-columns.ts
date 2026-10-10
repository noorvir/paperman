import { useEffect, useState } from "react";
import { z } from "zod";

const schema = z.object({
  date: z.boolean().default(true),
  owners: z.boolean().default(true),
  creators: z.boolean().default(true),
  tags: z.boolean().default(true),
  verification: z.boolean().default(true),
  processed: z.boolean().default(true),
});
export type DocumentColumns = z.infer<typeof schema>;
export const defaultDocumentColumns = schema.parse({});
const key = "paperman.document-columns";

export function useDocumentColumns() {
  const [columns, setColumns] = useState(defaultDocumentColumns);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = schema.safeParse(JSON.parse(saved));
        if (parsed.success) setColumns(parsed.data);
      }
    } catch {
      // Storage may be disabled in this browser.
    }
  }, []);
  function update(next: DocumentColumns) {
    setColumns(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Keep the controls usable when browser storage is unavailable.
    }
  }
  return { columns, setColumns: update };
}
