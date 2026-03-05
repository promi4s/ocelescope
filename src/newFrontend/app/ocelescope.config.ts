import type { OcelescopeConfig } from "@ocelescope/core";
import filter from "@ocelescope/filter";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default { modules: [filter, ocelot, plugin] } satisfies OcelescopeConfig;
