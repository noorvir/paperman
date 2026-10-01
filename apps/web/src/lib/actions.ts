import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, unwrap } from "./api.server";
import { catalogIconInput } from "./catalog-icons";
import { catalogKind } from "./queries";

const entryInput = z.object({
  name: z.string().trim().min(1).max(120),
  aliases: z.array(z.string()),
  icon: catalogIconInput.default("auto"),
});
export const saveEntry = createServerFn({ method: "POST" })
  .validator(z.object({ kind: catalogKind, id: z.string(), value: entryInput }))
  .handler(async ({ data: { kind, id, value } }) => {
    if (id) {
      const result = await client.PUT("/api/catalog/{kind}/{entry_id}", {
        params: { path: { kind, entry_id: id } },
        body: value,
      });
      return unwrap(result);
    }
    const result = await client.POST("/api/catalog/{kind}", {
      params: { path: { kind } },
      body: value,
    });
    return unwrap(result);
  });
export const deleteEntry = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: catalogKind,
      id: z.string(),
      reassignTo: z.string().optional(),
    }),
  )
  .handler(async ({ data: { kind, id, reassignTo } }) => {
    const result = await client.DELETE("/api/catalog/{kind}/{entry_id}", {
      params: {
        path: { kind, entry_id: id },
        query: { reassign_to: reassignTo },
      },
    });
    return unwrap(result);
  });
export const settingsInput = z.object({
  provider: z.enum(["compatible", "ollama", "demo"]),
  reasoning_effort: z.enum(["default", "none", "low", "medium", "high"]),
  base_url: z.string(),
  model: z.string(),
  timeout_seconds: z.number().min(5).max(1800),
  output_mode: z.enum(["prompted", "native", "tool"]),
  review_before_filing: z.boolean(),
  ocr_languages: z.string().min(1),
});
export const saveSettings = createServerFn({ method: "POST" })
  .validator(settingsInput)
  .handler(async ({ data }) => {
    const result = await client.PUT("/api/settings", { body: data });
    return unwrap(result);
  });
export const retryScan = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data }) => {
    const result = await client.POST("/api/scans/{scan_id}/retry", {
      params: { path: { scan_id: data } },
    });
    return unwrap(result);
  });
export const proposalInput = z.object({
  documents: z
    .array(
      z.object({
        pages: z.array(z.number().int().min(1)).min(1),
        owner_id: z.string(),
        title: z.string().trim().min(1),
        document_date: z.string().nullable(),
        confidence: z.number().min(0).max(1),
        review_reason: z.string(),
      }),
    )
    .min(1),
});
export const approveScan = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), proposal: proposalInput }))
  .handler(async ({ data: { id, proposal } }) => {
    const result = await client.PUT("/api/scans/{scan_id}/review", {
      params: { path: { scan_id: id } },
      body: proposal,
    });
    return unwrap(result);
  });
export const saveDocumentTags = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), tags: z.array(z.string()) }))
  .handler(async ({ data: { id, tags } }) => {
    const result = await client.PUT("/api/documents/{document_id}/tags", {
      params: { path: { document_id: id } },
      body: { tag_ids: tags },
    });
    return unwrap(result);
  });
export const enrichDocument = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data }) => {
    const result = await client.POST("/api/documents/{document_id}/enrich", {
      params: { path: { document_id: data } },
    });
    return unwrap(result);
  });
export const rebuildIndex = createServerFn({ method: "POST" }).handler(
  async () => {
    const result = await client.POST("/api/search/rebuild");
    return unwrap(result);
  },
);
