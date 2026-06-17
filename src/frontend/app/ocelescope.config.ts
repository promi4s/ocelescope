import type { OcelescopeConfig } from "@ocelescope/core";
import discovery from "@ocelescope/discovery";
import filter from "@ocelescope/filter";
import overview from "@ocelescope/log-overview";
import management from "@ocelescope/management";
import ocelot from "@ocelescope/ocelot";
import plugin from "@ocelescope/plugin";

export default {
  modules: [management, overview, plugin, discovery, filter, ocelot],
  navbarGroups: [
    {
      modulesNames: [
        management.name,
        overview.name,
        filter.name,
        discovery.name,
      ],
    },
    {
      modulesNames: [plugin.name],
    },
    { title: "Modules", modulesNames: [ocelot.name] },
  ],
} satisfies OcelescopeConfig;
