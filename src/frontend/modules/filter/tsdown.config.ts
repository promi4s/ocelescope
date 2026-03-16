import { mergeCssPlugin } from "@ocelescope/merge-css-plugin";
import { defineConfig } from "tsdown";
import LightningCSS from "unplugin-lightningcss/rolldown";

export default defineConfig({
  platform: "neutral",
  entry: ["src/index.ts", "src/styles.css"],
  plugins: [
    LightningCSS({
      options: { minify: true },
    }),
    mergeCssPlugin("styles.css"),
  ],
});
