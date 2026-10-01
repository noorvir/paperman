import createClient from "openapi-fetch";
import { z } from "zod";
import type { paths } from "./schema";

export const apiBaseUrl =
  process.env.PAPERMAN_API_URL ?? "http://127.0.0.1:3000";

export const client = createClient<paths>({
  baseUrl: apiBaseUrl,
});

export function unwrap<T>({
  data,
  error,
  response,
}: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (data !== undefined) return data;
  const detail = z.object({ detail: z.string() }).safeParse(error);
  throw new Error(
    detail.success ? detail.data.detail : `Request failed (${response.status})`,
  );
}

export async function proxyApi({ request }: { request: Request }) {
  const url = new URL(request.url);
  try {
    return await fetch(
      new Request(new URL(url.pathname + url.search, apiBaseUrl), request),
    );
  } catch {
    return Response.json(
      { detail: "Document service is unavailable" },
      { status: 503 },
    );
  }
}
