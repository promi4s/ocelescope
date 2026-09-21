import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(new URL("./catalog.json", import.meta.url), "utf8"),
);

export const hooks = {
  // Ocelescope's versions win over the module's own catalog, so the
  // module always builds against what the installed release expects.
  updateConfig(config) {
    config.catalogs ??= {};
    config.catalogs.default = { ...config.catalogs.default, ...catalog };
    return config;
  },
};
