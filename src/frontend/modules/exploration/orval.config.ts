import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  querying: {
    output: {
      target: "./src/api/querying.ts",
    },
  },
});
