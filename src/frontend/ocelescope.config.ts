import type OcelescopeConfig from "./types/ocelescope";

import ocelotModule from "./modules/ocelot";
import filterModule from "./modules/filter";

const config: OcelescopeConfig = {
  modules: [ocelotModule, filterModule],
};

export default config;
