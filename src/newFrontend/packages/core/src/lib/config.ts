import type { SVGProps } from "react";

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

export type OcelescopeConfig = {
  homePage?: React.FC;
  modules?: readonly ModuleDefinition[];
};

export const defineModule = (def: ModuleDefinition) => def;

export const defineModuleRoute = (def: ModuleRouteDefinition) => def;
