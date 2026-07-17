import type { OcelescopeConfig } from "@ocelescope/core";
import discovery from "@ocelescope/discovery";
import exploration from "@ocelescope/exploration";
import filter from "@ocelescope/filter";
import overview from "@ocelescope/log-overview";
import management from "@ocelescope/management";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";
import variants from "@ocelescope/variants";
export default {
  modules: [
    management,
    overview,
    exploration,
    plugin,
    discovery,
    filter,
    ocelot,
    variants,
  ],
  navbarGroups: [
    {
      modulesNames: [
        management.name,
        overview.name,
        exploration.name,
        filter.name,
        discovery.name,
        variants.name,
      ],
    },
    {
      modulesNames: [plugin.name],
    },
    { title: "Modules", modulesNames: [ocelot.name] },
  ],
} satisfies OcelescopeConfig;
