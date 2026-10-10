import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { client, unwrap } from "./api.server";

import { documentSearch, scanSearch, dashboardSearch } from "./search";
export {
  documentSearch,
  documentView,
  scanSearch,
  catalogKind,
  dashboardSearch,
} from "./search";

export const getDashboard = createServerFn({ method: "GET" })
  .validator(dashboardSearch.omit({ panel: true }))
  .handler(async ({ data }) => {
    const result = await client.GET("/api/dashboard", {
      params: { query: { ...data, status: data.status || "complete" } },
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
  .validator(
    documentSearch.omit({ layout: true, columns: true, context: true }),
  )
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
