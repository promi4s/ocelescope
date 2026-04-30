import { defineConfig } from "tsdown";

export default defineConfig({
  platform: "neutral",
  entry: ["src/index.ts"],
  css: {
    modules: {
      scopeBehaviour: "local",
      generateScopedName: "[hash]_[local]",
      localsConvention: "camelCase",
    },
  },
});
