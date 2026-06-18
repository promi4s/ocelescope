import z from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_PROJECT_PAGE: z.url().default("https://www.ocelescope.org/"),
  })
  .transform(({ NEXT_PUBLIC_PROJECT_PAGE }) => ({
    projectPage: NEXT_PUBLIC_PROJECT_PAGE,
  }));

export const env = schema.parse(process.env);
