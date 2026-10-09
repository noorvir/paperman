import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/lib/auth/auth.server";

async function handler({ request }: { request: Request }) {
  const runtime = await getAuth();
  if (!runtime) {
    return Response.json(
      { message: "Authentication is disabled" },
      { status: 404 },
    );
  }
  return runtime.auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handler, POST: handler } },
});
