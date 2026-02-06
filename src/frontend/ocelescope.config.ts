import type OcelescopeConfig from "./types/ocelescope";

import ocelotModule from "./modules/ocelot";
import filterModule from "./modules/filter";
import pluginModule from "./modules/plugins";
import PluginHomePage from "./modules/plugins/pages/HomePage";

const config: OcelescopeConfig = {
  homePage: PluginHomePage,
  modules: [pluginModule, ocelotModule, filterModule],
};

export default config;
