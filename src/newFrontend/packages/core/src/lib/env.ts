import z from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_BACKEND_URL: z.url().default("/api/external"),
    NEXT_PUBLIC_OCELESCOPE_SESSION_ID: z
      .string()
      .default("ocelescope-session-id"),
  })
  .transform(
    ({ NEXT_PUBLIC_OCELESCOPE_SESSION_ID, NEXT_PUBLIC_BACKEND_URL }) => ({
      session_id: NEXT_PUBLIC_BACKEND_URL,
      backend_url: NEXT_PUBLIC_BACKEND_URL,
    }),
  );

export const env = schema.parse(process.env);
