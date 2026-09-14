import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { PluginForm } from "@ocelescope/plugin-form";
import { useDiscoveryMethods } from "../hooks/useDiscoveryMethods";
import { LoadingOverlay, Select, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";

const DiscoveryPage = () => {
  const { discoveryGroups, discoveryMethods, isLoading } =
    useDiscoveryMethods();

  const { id } = useCurrentOcel();

  const [currentMethod, setCurrentMethod] = useState<
    (typeof discoveryMethods)[number] | undefined
  >(undefined);

  useEffect(() => {
    if (discoveryMethods.length > 1 && !currentMethod) {
      setCurrentMethod(discoveryMethods[0]);
    }
  }, [discoveryMethods]);

  return (
    <Stack pos={"relative"}>
      <LoadingOverlay visible={isLoading} />
      <Select
        label="Discovery Method"
        searchable
        value={currentMethod?.id}
        onChange={(newMethod) =>
          setCurrentMethod(discoveryMethods.find(({ id }) => id == newMethod))
        }
        data={discoveryGroups
          .filter(({ methods }) => methods.length > 0)
          .map(({ label, methods }) => ({
            group: label,
            items: methods.map(({ label, id }) => ({
              value: id,
              label,
            })),
          }))}
        loading={isLoading}
      />
      {currentMethod && (
        <>
          <Text c={"dimmed"}>{currentMethod.description}</Text>
          {currentMethod.configuration_schema && (
            <PluginForm
              key={currentMethod.id}
              methodName={currentMethod?.name}
              pluginId={currentMethod?.pluginId}
              schema={currentMethod?.configuration_schema}
              inputResources={{ [currentMethod.input.name]: id }}
              onChange={() => {}}
              value={{}}
              onSubmit={() => {}}
            />
          )}
        </>
      )}
    </Stack>
  );
};

export default defineModuleRoute({
  label: "Discovery",
  name: "discovery",
  component: DiscoveryPage,
  requiresOcel: true,
});
