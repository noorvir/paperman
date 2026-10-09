import { authConfig } from "./auth/config.server";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { identityHeaders } from "./auth/session.server";
import createClient from "openapi-fetch";
import { z } from "zod";
import type { paths } from "./schema";

export const apiBaseUrl =
  process.env.PAPERMAN_API_URL ?? "http://127.0.0.1:3000";

export const client = createClient<paths>({
  baseUrl: apiBaseUrl,
});

client.use({
  onResponse({ response }) {
    checkApiMode(response);
    return response;
  },
  async onRequest({ request }) {
    const headers = await identityHeaders(getRequestHeaders());
    if (!headers) {
      throw redirect({ to: "/login" });
    }
    request.headers.delete("authorization");
    headers.forEach((value, key) => request.headers.set(key, value));
    return request;
  },
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
  const headers = await identityHeaders(request.headers);
  if (!headers) {
    return Response.json({ detail: "Sign in to continue" }, { status: 401 });
  }
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== url.origin
  ) {
    return Response.json({ detail: "Invalid request origin" }, { status: 403 });
  }
  const forwarded = new Request(
    new URL(url.pathname + url.search, apiBaseUrl),
    request,
  );
  forwarded.headers.delete("authorization");
  forwarded.headers.delete("cookie");
  headers.forEach((value, key) => forwarded.headers.set(key, value));
  try {
    const response = await fetch(forwarded);
    checkApiMode(response);
    const result = new Response(response.body, response);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  } catch {
    return Response.json(
      { detail: "Document service is unavailable" },
      { status: 503 },
    );
  }
}

function checkApiMode(response: Response) {
  const expected = authConfig() ? "enabled" : "disabled";
  if (response.headers.get("X-PaperMan-Auth") !== expected) {
    throw new Error(
      "Web and API authentication settings do not match. Check the service configuration.",
    );
  }
}
