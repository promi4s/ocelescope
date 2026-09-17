import { defineConfig } from "tsdown";

export default defineConfig({
  platform: "neutral",
  deps: { resolveDepSubpath: true },
  entry: ["src/index.ts"],
});
