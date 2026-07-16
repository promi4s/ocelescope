import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  base: {
    output: {
      target: "./src/api/base/index.ts",
      override: {
        operations: {
          getComputedValues: { query: { useQuery: true } },
        },
      },
    },
  },
  ocel: {
    input: "./ocel.openapi.json",
    output: {
      target: "./src/api/ocel/index.ts",
    },
  },
});
