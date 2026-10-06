import { useGetOcels } from "@ocelescope/api-base";
import { useCallback } from "react";
import type { ModuleRouteDefinition } from "../lib/config";
import { useCurrentOcel } from "./useCurrentOCEL";

/**
 * Whether a route's `requiresOcel` is met: `true` by any log in the session, a
 * list of extension names by a selected log that is of all of them.
 */
export const useOcelRequirement = () => {
  const { id } = useCurrentOcel();
  const { data: ocels } = useGetOcels();

  return useCallback(
    (requiresOcel: ModuleRouteDefinition["requiresOcel"]) => {
      // nothing is held back while the logs are still loading
      if (!requiresOcel || !ocels) return true;
      if (requiresOcel === true) return ocels.length > 0;

      const names = ocels
        .find((ocel) => ocel.id === id)
        ?.extensions?.map(({ name }) => name);

      return requiresOcel.every((name) => names?.includes(name));
    },
    [ocels, id],
  );
};
