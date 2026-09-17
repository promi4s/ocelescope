import {
  type OCELIOApi,
  type ResourceIOApi,
  usePlugins,
} from "@ocelescope/api-base";
import { useMemo } from "react";

export const useDiscoveryMethods = () => {
  const { data: plugins, isLoading } = usePlugins({ include_base: true });

  const discoveryGroups = useMemo(() => {
    return (plugins ?? []).map(({ methods, ...plugin }) => ({
      ...plugin,
      methods: methods
        .filter(
          ({ inputs, outputs }) =>
            inputs.length === 1 &&
            outputs.length === 1 &&
            inputs[0]?.type === "ocel" &&
            outputs[0]?.type === "resource",
        )
        .map(({ outputs, inputs, ...rest }) => ({
          ...rest,
          id: `${plugin.id}:${rest.name}`,
          input: inputs[0]! as OCELIOApi,
          pluginId: plugin.id,
          output: outputs[0]! as ResourceIOApi,
        })),
    }));
  }, [plugins]);

  const discoveryMethods = useMemo(
    () => discoveryGroups.flatMap(({ methods }) => methods),
    [discoveryGroups],
  );

  return { discoveryGroups, discoveryMethods, isLoading };
};
