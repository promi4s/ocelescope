import type { OcelescopeConfig } from "@ocelescope/core";
import discovery from "@ocelescope/discovery";
import filter from "@ocelescope/filter";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default {
  modules: [plugin, discovery, filter, ocelot],
} satisfies OcelescopeConfig;
