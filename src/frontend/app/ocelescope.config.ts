import type { OcelescopeConfig } from "@ocelescope/core";
import executions from "@ocelescope/executions";
import filter from "@ocelescope/filter";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default {
  modules: [plugin, filter, ocelot, executions],
} satisfies OcelescopeConfig;
