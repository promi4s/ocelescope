import { defineConfig } from "@ocelescope/api-config";

export default defineConfig({
  /**
   * Models only. Every analysis is `POST /ocels/{id}/queries/{analysis}`, so
   * the module calls them through one hook (`useAnalysisQuery`) instead of ten
   * generated ones; excluding the operations keeps the request types without
   * generating a client nobody imports.
   */
  exploration: {
    input: {
      target: "./openapi.json",
      filters: {
        mode: "exclude",
        tags: ["exploration"],
        includeUnreferencedSchemas: true,
      },
    },
    output: {
      target: "./src/api/exploration.ts",
    },
  },
  ocel: {
    input: "./openapi-ocel.json",
    output: {
      target: "./src/api/ocel/index.ts",
    },
  },
});
