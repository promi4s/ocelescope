import ocelot from "@ocelescope/ocelot";
import filter from "@ocelescope/filter";
import type { OcelescopeConfig } from "@ocelescope/core";

export default { modules: [ocelot, filter] } satisfies OcelescopeConfig;
