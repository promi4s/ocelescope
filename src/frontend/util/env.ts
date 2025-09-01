import z from "zod";

const envSchema = z
  .object({
    backendUrl: z.url().default("http://localhost:8000"),
    oceanSessionId: z.string().default("ocean-session-id"),
  })
  .transform((env) => ({
    ...env,
    websocketUrl: `ws://${new URL(env.backendUrl).host}/ws`,
  }));

export const env = envSchema.parse(process.env);
