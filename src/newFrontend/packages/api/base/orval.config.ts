import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  base: {
    output: {
      target: "./src/api/base.ts",
      override: {
        operations: {
          getComputedValues: { query: { useQuery: true } },
        },
      },
    },
  },
});
