import { defineConfig } from "orval";
export default defineConfig({
  coreapi: {
    input: "./openapi.json",

    output: {
      mode: "single",
      target: "./src/api/coreApi.ts",
      client: "react-query",
      httpClient: "fetch",
      baseUrl: "/api/external",
      clean: true,
      override: {
        mutator: {
          path: "./src/lib/fetcher.ts",
          name: "customFetch",
        },
        operations: {
          getComputedValues: { query: { useQuery: true } },
        },
        query: {
          options: {
            staleTime: 1000 * 60 * 5,
          },
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});
