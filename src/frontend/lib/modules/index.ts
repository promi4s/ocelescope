import type {
  ModuleDefinition,
  ModuleName,
  ModuleRouteDefinition,
  ModuleRouteName,
} from "@/types/modules";

export const defineModule = (def: ModuleDefinition) => def;

export const defineModuleRoute = (def: ModuleRouteDefinition) => def;

export const getModuleRoute = <K extends ModuleName>({
  name,
  route,
}: {
  name: K;
  route?: ModuleRouteName<K>;
}) => `/modules/${name}${route ? `/${route}` : ""}`;
