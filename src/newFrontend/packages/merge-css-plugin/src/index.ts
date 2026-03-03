import type { Plugin, OutputAsset, OutputChunk } from "rolldown";

function isCssAsset(x: OutputAsset | OutputChunk): x is OutputAsset {
  return (
    x.type === "asset" &&
    typeof (x as OutputAsset).fileName === "string" &&
    x.fileName.endsWith(".css")
  );
}

export const mergeCssPlugin = (outFile = "assets/styles.css"): Plugin => ({
  name: "merge-css",
  generateBundle(_opts, bundle) {
    const cssAssets = Object.values(bundle).filter(isCssAsset);

    if (cssAssets.length === 0) return;

    cssAssets.sort((a, b) => {
      const aIsEntry =
        a.fileName.includes("styles") || a.fileName.includes("style");
      const bIsEntry =
        b.fileName.includes("styles") || b.fileName.includes("style");
      return (
        Number(bIsEntry) - Number(aIsEntry) ||
        a.fileName.localeCompare(b.fileName)
      );
    });

    const merged = cssAssets.map((a) => String(a.source ?? "")).join("\n\n");

    this.emitFile({ type: "asset", fileName: outFile, source: merged });

    for (const a of cssAssets) {
      delete bundle[a.fileName];
    }
  },
});
