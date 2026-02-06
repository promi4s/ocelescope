import type { ModuleDefinition } from "./modules";

type OcelescopeConfig = {
  homePage: React.FC;
  modules: readonly ModuleDefinition[];
};

export default OcelescopeConfig;
