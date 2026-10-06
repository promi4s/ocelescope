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
  /**
   * `true` when the route needs a log, a list of extension names (e.g.
   * `["qel"]`) when it needs a log of those OCEL extensions.
   */
  requiresOcel?: boolean | string[];
  component: React.ComponentType;
};

export type OcelescopeConfig = {
  modules?: readonly ModuleDefinition[];
  navbarGroups?: {
    title?: string;
    modulesNames: string[];
  }[];
};

export const defineModule = (def: ModuleDefinition) => def;

export const defineModuleRoute = (def: ModuleRouteDefinition) => def;
