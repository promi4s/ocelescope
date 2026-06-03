import type { OcelescopeConfig } from "@ocelescope/core";
import discovery from "@ocelescope/discovery";
import filter from "@ocelescope/filter";
import overview from "@ocelescope/log-overview";
import management from "@ocelescope/management";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default {
  modules: [plugin, discovery, filter, ocelot],
  modules: [management, overview, plugin, filter, ocelot],
} satisfies OcelescopeConfig;
