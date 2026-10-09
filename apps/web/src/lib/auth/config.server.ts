import { z } from "zod";

export function authConfig() {
  const enabled = z
    .enum(["true", "false"])
    .default("false")
    .parse(process.env.PAPERMAN_AUTH_ENABLED);
  if (enabled === "false") {
    return null;
  }
  return z
    .object({
      url: z.url(),
      database: z.string().min(1),
      secret: z.string().min(32),
      apiSecret: z.string().min(32),
    })
    .parse({
      url: process.env.PAPERMAN_AUTH_URL,
      database: process.env.PAPERMAN_AUTH_DATABASE,
      secret: process.env.PAPERMAN_AUTH_SECRET,
      apiSecret: process.env.PAPERMAN_API_AUTH_SECRET,
    });
}
