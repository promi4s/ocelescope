// Writes catalog.json: the workspace catalog plus every published
// @ocelescope/* package pinned to its current version.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const pnpm = (...args) =>
  JSON.parse(execFileSync("pnpm", [...args, "--json"], { encoding: "utf8" }));

const self = pnpm("pkg", "get", "name");
const catalog = pnpm("config", "get", "catalog");

for (const { name, version, private: isPrivate } of pnpm(
  "ls",
  "-r",
  "--depth",
  "-1",
)) {
  if (!isPrivate && name !== self) catalog[name] = `^${version}`;
}

const sorted = Object.fromEntries(
  Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(
  new URL("../catalog.json", import.meta.url),
  `${JSON.stringify(sorted, null, 2)}\n`,
);
console.log(`catalog.json: ${Object.keys(sorted).length} entries`);
