import { defineConfig } from "orval";
export default defineConfig({
  fastapi: {
    input: "./api/openapi.json",

    output: {
      mode: "tags-split",
      target: "./api/fastapi",
      schemas: "./api/fastapi-schemas",
      client: "react-query",
      httpClient: "fetch",
      baseUrl: "/api",
      clean: true,
      override: {
        mutator: {
          path: "./api/fetcher.ts",
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
