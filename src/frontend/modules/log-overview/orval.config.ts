import { defineConfig } from "@ocelescope/api-config";

// log-overview endpoints are RPC-style POSTs but semantically idempotent reads,
// so each one is generated as a useQuery hook instead of useMutation.
const asQuery = { query: { useQuery: true, useMutation: false } } as const;

export default defineConfig({
  base: {
    output: {
      target: "./src/api/base.ts",
      override: {
        operations: {
          eventAttributes: asQuery,
          eventAttributeHistogram: asQuery,
          eventAttributeInstances: asQuery,
        },
      },
    },
  },
});
