import { defineConfig } from "tsdown";

export default defineConfig({
  platform: "neutral",
  entry: ["src/index.ts", "src/styles.css"],
  css: {
    modules: {
      // Scoping behavior: 'local' (default) or 'global'
      scopeBehaviour: "local",

      // Pattern for scoped class names (Lightning CSS pattern syntax)
      generateScopedName: "[hash]_[local]",

      // Transform class name convention in JS exports
      localsConvention: "camelCase",
    },
  },
});
