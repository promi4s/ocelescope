import type OcelescopeConfig from "./types/ocelescope";

import ocelotModule from "./modules/ocelot";
import filterModule from "./modules/filter";
import pluginModule from "./modules/plugins";
import HomePage from "./modules/plugins/pages/HomePage";

const config: OcelescopeConfig = {
  homePage: HomePage,
  modules: [pluginModule, ocelotModule, filterModule],
};

export default config;
