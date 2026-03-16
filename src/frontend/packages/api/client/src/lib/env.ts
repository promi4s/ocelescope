import z from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_BACKEND_URL: z.url().default("/api/external"),
    NEXT_PUBLIC_APPLICATION_ID: z.string().default("ocelescope"),
    NEXT_PUBLIC_SSE_URL: z.string().default("/api/events"),
  })
  .transform(
    ({
      NEXT_PUBLIC_APPLICATION_ID,
      NEXT_PUBLIC_BACKEND_URL,
      NEXT_PUBLIC_SSE_URL,
    }) => ({
      session_id: `${NEXT_PUBLIC_APPLICATION_ID}-session-id`,
      current_ocel_id: `${NEXT_PUBLIC_APPLICATION_ID}-current-ocel-id`,
      backend_url: NEXT_PUBLIC_BACKEND_URL,
      event_url: NEXT_PUBLIC_SSE_URL,
    }),
  );

export const env = schema.parse(process.env);
