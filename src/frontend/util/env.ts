import z from "zod";

const schema = z.object({
  NEXT_PUBLIC_BACKEND_URL: z.url().default("/api/external"),
  NEXT_PUBLIC_EVENTS_URL: z.url().default("/api/events"),
  NEXT_PUBLIC_OCEAN_SESSION_ID: z.string().default("ocean-session-id"),
});

export const env = schema.parse(process.env);
