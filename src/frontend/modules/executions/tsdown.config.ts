import { defineConfig } from "tsdown";

export default defineConfig({
  platform: "neutral",
  dts: true,
  exports: true,
  css: {
    modules: {
      scopeBehaviour: "local",

      generateScopedName: "[hash]_[local]",

      localsConvention: "camelCase",
    },
  },
});
