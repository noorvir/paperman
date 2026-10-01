import { createFileRoute } from "@tanstack/react-router";
import { proxyApi } from "@/lib/api.server";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: proxyApi,
      POST: proxyApi,
      PUT: proxyApi,
      DELETE: proxyApi,
    },
  },
});
