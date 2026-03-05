import ocelot from "@ocelescope/ocelot";
import filter from "@ocelescope/filter";
import plugin from "@ocelescope/plugin";
import type { OcelescopeConfig } from "@ocelescope/core";

export default { modules: [filter, ocelot, plugin] } satisfies OcelescopeConfig;
