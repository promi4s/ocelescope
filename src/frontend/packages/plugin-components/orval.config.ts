import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  base: {
    output: {
      target: "./src/api/plugin.ts",
      override: {
        operations: {
          getComputedValues: { query: { useQuery: true } },
        },
      },
    },
  },
});
