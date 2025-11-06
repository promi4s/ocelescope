import z from "zod";

const envSchema = z.object({
  backendUrl: z.url().default("/api/external"),
  oceanSessionId: z.string().default("ocean-session-id"),
});

export const env = envSchema.parse(process.env);
