import { z } from "zod";

export const documentColumns = z.object({
  date: z.boolean().default(true),
  owners: z.boolean().default(true),
  creators: z.boolean().default(true),
  tags: z.boolean().default(true),
  verification: z.boolean().default(true),
  processed: z.boolean().default(true),
});
export type DocumentColumns = z.infer<typeof documentColumns>;
export const defaultDocumentColumns = documentColumns.parse({});

export const pdfSearch = z.object({
  zoom: z
    .union([
      z.enum(["automatic", "fit-page", "fit-width"]),
      z.number().min(0.25).max(3),
    ])
    .default("automatic"),
});

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
  columns: documentColumns.default(defaultDocumentColumns),
  context: z.boolean().default(false),
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
      z.literal(""),
    ])
    .default(""),
  panel: z.enum(["documents", "attention"]).default("documents"),
  page: z.coerce.number().int().min(1).default(1),
});

export const documentPreferences = documentSearch.omit({ page: true }).extend({
  view: documentView.default("pdf"),
});
export const scanViewSearch = z.object({
  view: z.enum(["pdf", "documents", "activity", "details"]).default("pdf"),
  layout: z.enum(["list", "grid"]).default("list"),
});
export const roadmapSearch = z.object({
  category: z.enum(["All", "Internal", "User facing"]).default("All"),
});
export const editorSearch = z.object({
  editorTab: z.enum(["details", "summary", "text"]).default("details"),
});
