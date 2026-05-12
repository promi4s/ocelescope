import type { OcelescopeConfig } from "@ocelescope/core";
import filter from "@ocelescope/filter";
import overview from "@ocelescope/log-overview";
import management from "@ocelescope/management";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default {
  modules: [management, overview, plugin, filter, ocelot],
} satisfies OcelescopeConfig;
