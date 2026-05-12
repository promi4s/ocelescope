import type { OcelescopeConfig } from "@ocelescope/core";
import filter from "@ocelescope/filter";
import management from "@ocelescope/management";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default {
  modules: [management, plugin, filter, ocelot],
} satisfies OcelescopeConfig;
