import { defineConfig } from "@ocelescope/api-config";

const asQuery = { query: { useQuery: true, useMutation: false } } as const;

export default defineConfig({
  querying: {
    output: {
      target: "./src/index.ts",
      override: {
        mutator: {
          path: "./fetcher.ts",
          name: "customFetch",
        },
        operations: { ocelQuery: asQuery },
      },
    },
  },
});
