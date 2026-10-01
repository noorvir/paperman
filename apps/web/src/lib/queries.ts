import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, unwrap } from "./api.server";

export const documentSearch = z.object({
  q: z.string().default(""),
  owner: z.string().default(""),
  tag: z.string().default(""),
  status: z.enum(["", "pending", "running", "complete", "failed"]).default(""),
  after: z.string().default(""),
  before: z.string().default(""),
  sort: z.enum(["date_desc", "date_asc", "title"]).default("date_desc"),
  page: z.coerce.number().int().min(1).default(1),
});
export const scanSearch = z.object({
  q: z.string().default(""),
  status: z
    .enum(["", "queued", "running", "review", "failed", "complete"])
    .default(""),
  page: z.coerce.number().int().min(1).default(1),
});
export const catalogKind = z.enum(["owners", "tags"]);

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await client.GET("/api/dashboard");
    return unwrap(result);
  },
);
export const getCatalog = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await client.GET("/api/catalog");
    return unwrap(result);
  },
);
export const getSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await client.GET("/api/settings");
    return unwrap(result);
  },
);
export const getDocuments = createServerFn({ method: "GET" })
  .validator(documentSearch)
  .handler(async ({ data }) => {
    const result = await client.GET("/api/documents", {
      params: {
        query: {
          ...data,
          after: data.after || undefined,
          before: data.before || undefined,
        },
      },
    });
    return unwrap(result);
  });
export const getDocument = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => {
    const result = await client.GET("/api/documents/{document_id}", {
      params: { path: { document_id: data } },
    });
    return unwrap(result);
  });
export const getScans = createServerFn({ method: "GET" })
  .validator(scanSearch)
  .handler(async ({ data }) => {
    const result = await client.GET("/api/scans", { params: { query: data } });
    return unwrap(result);
  });
export const getScan = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => {
    const result = await client.GET("/api/scans/{scan_id}", {
      params: { path: { scan_id: data } },
    });
    return unwrap(result);
  });
