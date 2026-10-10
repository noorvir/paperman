import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, unwrap } from "./api.server";

const filterValues = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => [
    ...new Set((typeof value === "string" ? [value] : value).filter(Boolean)),
  ])
  .default([]);

export const documentSearch = z.object({
  delivery: z.enum(["", "review", "delivered"]).default(""),
  inbox: z.string().default(""),
  q: z.string().default(""),
  owner: filterValues,
  creator: filterValues,
  tag: filterValues,
  status: z.enum(["", "pending", "running", "complete", "failed"]).default(""),
  after: z.union([z.literal(""), z.iso.date()]).default(""),
  before: z.union([z.literal(""), z.iso.date()]).default(""),
  sort: z
    .enum([
      "date_desc",
      "date_asc",
      "title",
      "title_desc",
      "creators_asc",
      "creators_desc",
      "owners_asc",
      "owners_desc",
      "tags_asc",
      "tags_desc",
      "verification_asc",
      "verification_desc",
      "delivery_asc",
      "delivery_desc",
      "processed_asc",
      "processed_desc",
    ])
    .default("date_desc"),
  layout: z.enum(["list", "grid"]).default("list"),
  page: z.coerce.number().int().min(1).default(1),
});
export const documentView = z.enum([
  "pdf",
  "text",
  "summary",
  "details",
  "source",
]);
export const scanSearch = z.object({
  inbox: z.string().default(""),
  q: z.string().default(""),
  status: z
    .enum(["", "queued", "running", "review", "failed", "complete"])
    .default(""),
  page: z.coerce.number().int().min(1).default(1),
});
export const catalogKind = z.enum(["owners", "tags", "creators"]);

export const dashboardSearch = z.object({
  status: z
    .union([
      scanSearch.shape.status.unwrap().exclude([""]),
      z.literal("unverified"),
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const getDashboard = createServerFn({ method: "GET" })
  .validator(dashboardSearch)
  .handler(async ({ data }) => {
    const result = await client.GET("/api/dashboard", {
      params: { query: { ...data, status: data.status ?? "complete" } },
    });
    return unwrap(result);
  });
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
  .validator(documentSearch.omit({ layout: true }))
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

export const getScanWithDocuments = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => {
    const result = await client.GET("/api/scans/{scan_id}", {
      params: { path: { scan_id: data } },
    });
    if (result.response.status === 404) {
      return null;
    }
    const scan = unwrap(result);
    const documents = await Promise.all(
      scan.document_ids.map(async (id) => {
        const result = await client.GET("/api/documents/{document_id}", {
          params: { path: { document_id: id } },
        });
        const detail = unwrap(result);
        return detail.document;
      }),
    );
    return { scan, documents };
  });

export const getInboxes = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await client.GET("/api/inboxes");
    return unwrap(result);
  },
);
