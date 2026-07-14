import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  base: {
    output: {
      // `base` and `ocel` share the ./src/api folder, so cleaning is disabled -
      // otherwise the second target would wipe the first's file.
      clean: false,
      target: "./src/api/base.ts",
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
      clean: false,
      target: "./src/api/ocel.ts",
    },
  },
});
