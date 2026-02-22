import injectCssPlugin from "@bosh-code/tsdown-plugin-inject-css";
import { defineConfig } from "tsdown";
import LightningCSS from "unplugin-lightningcss/rolldown";
export default defineConfig({
  platform: "neutral",
  entry: ["src/index.ts", "src/styles/styles.ts"],
  plugins: [
    LightningCSS({
      options: {
        minify: true,
      },
    }),
    injectCssPlugin(),
  ],
});
