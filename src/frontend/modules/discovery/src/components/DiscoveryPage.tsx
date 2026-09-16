import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { PluginForm, ResultSection } from "@ocelescope/plugin-components";
import { useDiscoveryMethods } from "../hooks/useDiscoveryMethods";
import Form from "@rjsf/core";
import {
  ActionIcon,
  Box,
  LoadingOverlay,
  ScrollArea,
  Select,
  Splitter,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { UiSchema } from "@rjsf/utils";
import { useDebouncedValue, type UseSplitterReturnValue } from "@mantine/hooks";
import { useRunPlugin } from "@ocelescope/api-base";
import { Settings } from "lucide-react";

const uiSchema: UiSchema = {
  "ui:submitButtonOptions": {
    norender: true,
  },
};

const DiscoverySideBar = ({
  onSuccess,
}: {
  onSuccess: (discoveryTaskId: string) => void;
}) => {
  const { discoveryGroups, discoveryMethods, isLoading } =
    useDiscoveryMethods();

  const { id } = useCurrentOcel();

  const [currentMethod, setCurrentMethod] = useState<
    (typeof discoveryMethods)[number] | undefined
  >(undefined);

  const { mutate } = useRunPlugin({
    mutation: { onSuccess },
  });

  const [currentConfInput, setConfInput] = useState({});
  const [debouncedInput] = useDebouncedValue(currentConfInput, 1000);

  const ref = useRef<Form>(null);

  useEffect(() => {
    if (discoveryMethods.length > 1 && !currentMethod) {
      setCurrentMethod(discoveryMethods[0]);
    }
  }, [discoveryMethods]);

  useEffect(() => {
    if (
      currentMethod &&
      id &&
      (!currentMethod.configuration_schema ||
        ref.current?.validate(debouncedInput).errors.length === 0)
    ) {
      mutate({
        methodName: currentMethod.name,
        pluginId: currentMethod.pluginId,
        data: {
          input_resources: { [currentMethod.input.name]: id },
          input: debouncedInput,
        },
      });
    }
  }, [ref, debouncedInput, currentMethod, id]);

  return (
    <Stack maw={400} px={"md"} h={"100%"}>
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
      {currentMethod && <Text c={"dimmed"}>{currentMethod.description}</Text>}
      <Box pos={"relative"} flex={1} mih={0}>
        <LoadingOverlay visible={isLoading} />
        {currentMethod?.configuration_schema && (
          <ScrollArea h={"100%"}>
            <PluginForm
              key={currentMethod.id}
              methodName={currentMethod.name}
              pluginId={currentMethod.pluginId}
              schema={currentMethod.configuration_schema}
              inputResources={{ [currentMethod.input.name]: id }}
              onChange={({ formData }) => setConfInput(formData)}
              formData={currentConfInput}
              ref={ref}
              uiSchema={uiSchema}
            />
          </ScrollArea>
        )}
      </Box>
    </Stack>
  );
};

const DiscoveryPage = () => {
  const [discoveryTask, setDiscoveryTask] = useState<string | undefined>(
    undefined,
  );

  const splitterRef = useRef<UseSplitterReturnValue>(null);

  return (
    <Splitter
      splitterRef={splitterRef}
      withHandle={false}
      h={"100%"}
      handleColor="var(--mantine-color-default-border)"
      lineSize={2}
    >
      <Splitter.Pane defaultSize={70}>
        <ResultSection
          taskId={discoveryTask}
          extraActions={
            <Tooltip label="Toogle settings">
              <ActionIcon
                size="input-sm"
                variant="outline"
                onClick={() => splitterRef.current?.toggleCollapse(1)}
              >
                <Settings size={20} />
              </ActionIcon>
            </Tooltip>
          }
        />
      </Splitter.Pane>
      <Splitter.Pane defaultSize={30} max={"400px"} min={"300px"} collapsible>
        <DiscoverySideBar
          onSuccess={(discoveryTaskId) => setDiscoveryTask(discoveryTaskId)}
        />
      </Splitter.Pane>
    </Splitter>
  );
};

export default defineModuleRoute({
  label: "Discovery",
  name: "discovery",
  component: DiscoveryPage,
  requiresOcel: true,
});
