import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { PluginForm, ResultSection } from "@ocelescope/plugin-components";
import { useDiscoveryMethods } from "../hooks/useDiscoveryMethods";
import Form from "@rjsf/core";
import {
  ActionIcon,
  LoadingOverlay,
  Select,
  Splitter,
  Stack,
  Text,
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
      ref.current?.validate(debouncedInput).errors.length === 0
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
  }, [ref, debouncedInput]);

  return (
    <Stack pos={"relative"} maw={400} p={"md"}>
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
              onChange={({ formData }) => setConfInput(formData)}
              formData={currentConfInput}
              ref={ref}
              uiSchema={uiSchema}
            />
          )}
        </>
      )}
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
            <ActionIcon
              size={"md"}
              variant="outline"
              onClick={() => splitterRef.current?.toggleCollapse(1)}
            >
              <Settings />
            </ActionIcon>
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
