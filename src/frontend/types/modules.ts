import moduleMap from "@/lib/modules/module-map";
import { SVGProps } from "react";

type Author = {
  name: string;
  link?: string;
};

export type ModuleDefinition = {
  name: string;
  label: string;
  authors: Author[];
  description: string;
  routes: ModuleRouteDefinition[];
  icon?: React.ComponentType<SVGProps<SVGSVGElement>>;
};

export type ModuleRouteDefinition = {
  name: string;
  label: string;
  requiresOcel?: boolean;
  component: React.ComponentType;
};

export type ModuleName = keyof typeof moduleMap;

export type RoutesByModule = {
  [K in ModuleName]: (typeof moduleMap)[K]["routes"];
};
export type ModuleRouteName<K extends ModuleName> = keyof RoutesByModule[K] &
  string;
