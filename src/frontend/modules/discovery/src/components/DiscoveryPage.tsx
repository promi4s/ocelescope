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
import { type UseSplitterReturnValue, useDebouncedValue } from "@mantine/hooks";
import { useRunPlugin } from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { PluginForm, ResultSection } from "@ocelescope/plugin-components";
import type Form from "@rjsf/core";
import type { UiSchema } from "@rjsf/utils";
import { Settings } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useDiscoveryMethods } from "../hooks/useDiscoveryMethods";

const uiSchema: UiSchema = {
  "ui:submitButtonOptions": {
    norender: true,
  },
};

type DiscoveryMethod = ReturnType<
  typeof useDiscoveryMethods
>["discoveryMethods"][number];

const DiscoveryConfiguration = ({
  method,
  ocelId,
  onSuccess,
}: {
  method: DiscoveryMethod;
  ocelId: string;
  onSuccess: (discoveryTaskId: string) => void;
}) => {
  const [input, setInput] = useState({});
  const [debouncedInput] = useDebouncedValue(input, 1000);

  const ref = useRef<Form>(null);

  const { mutate } = useRunPlugin({
    mutation: { onSuccess },
  });

  const run = useEffectEvent((data: typeof debouncedInput) => {
    if (
      method.configuration_schema &&
      ref.current?.validate(data).errors.length !== 0
    ) {
      return;
    }

    mutate({
      methodName: method.name,
      pluginId: method.pluginId,
      data: {
        input_resources: { [method.input.name]: ocelId },
        input: data,
      },
    });
  });

  useEffect(() => {
    run(debouncedInput);
  }, [debouncedInput]);

  return (
    method.configuration_schema && (
      <ScrollArea h={"100%"} offsetScrollbars>
        <PluginForm
          methodName={method.name}
          pluginId={method.pluginId}
          schema={method.configuration_schema}
          inputResources={{ [method.input.name]: ocelId }}
          onChange={({ formData }) => setInput(formData)}
          formData={input}
          ref={ref}
          uiSchema={uiSchema}
        />
      </ScrollArea>
    )
  );
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
    DiscoveryMethod | undefined
  >(undefined);

  useEffect(() => {
    if (discoveryMethods.length > 0 && !currentMethod) {
      setCurrentMethod(discoveryMethods[0]);
    }
  }, [discoveryMethods]);

  return (
    <Stack maw={400} px={"md"} h={"100%"}>
      <Select
        label="Discovery Method"
        searchable
        value={currentMethod?.id}
        onChange={(newMethod) =>
          setCurrentMethod(discoveryMethods.find(({ id }) => id === newMethod))
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
        {currentMethod && id && (
          <DiscoveryConfiguration
            key={`${currentMethod.id}:${id}`}
            method={currentMethod}
            ocelId={id}
            onSuccess={onSuccess}
          />
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
            <Tooltip label="Toggle settings">
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
