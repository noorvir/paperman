import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
} from "@tanstack/react-start";

import { setResponseHeader } from "@tanstack/react-start/server";
import { authConfig } from "./lib/auth/config.server";

const privateResponses = createMiddleware().server(async ({ next }) => {
  if (authConfig()) {
    setResponseHeader("Cache-Control", "private, no-store");
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    privateResponses,
    createCsrfMiddleware({
      filter: ({ handlerType }) => handlerType === "serverFn",
    }),
  ],
}));
