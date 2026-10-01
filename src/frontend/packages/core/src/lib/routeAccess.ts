import type { OcelMetadata } from "@ocelescope/api-base";
import type { ModuleRouteDefinition } from "./config";

/** Extension requirements apply to the selected log, including its active filters. */
export const canAccessRoute = (
  route: ModuleRouteDefinition,
  ocel: OcelMetadata | undefined,
): boolean =>
  (!route.requiresOcel || !!ocel) &&
  (route.requiresExtensions ?? []).every((id) =>
    ocel?.extensions?.some((extension) => extension.id === id),
  );
