import type { defineConfig as defineOrvalConfig, Options } from "orval";

const generateOptions = (options: Options) =>
  ({
    ...options,
    input: options.input ?? "./openapi.json",
    output:
      typeof options.output === "string"
        ? options.output
        : {
            mode: options.output?.mode ?? "single",
            target: options.output?.target ?? "./src/api/coreApi.ts",
            client: options.output?.client ?? "react-query",
            httpClient: options.output?.httpClient ?? "fetch",
            baseUrl: options.output?.baseUrl ?? "/api/external",
            clean: options.output?.clean ?? true,
            override: {
              mutator: {
                path: "./src/lib/fetcher.ts",
                name: "customFetch",
              },
              query: {
                options: {
                  staleTime: 1000 * 60 * 5,
                },
              },
              fetch: {
                includeHttpResponseReturnType: false,
              },
              ...options.output?.override,
            },
          },
  }) satisfies Options;

export const defineConfig: typeof defineOrvalConfig = (config) => {
  return defineConfig(
    Object.fromEntries(
      Object.entries(config).map(([name, config]) => [
        name,
        generateOptions(config),
      ]),
    ),
  );
};
