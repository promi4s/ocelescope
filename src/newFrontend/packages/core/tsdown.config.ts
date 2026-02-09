import { defineConfig } from "tsdown";

export default defineConfig({
  platform: "neutral",
  entry: ["src/index.ts", "src/styles/styles.ts"],
});
