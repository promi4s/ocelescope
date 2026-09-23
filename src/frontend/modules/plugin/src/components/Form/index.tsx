import {
  ActionIcon,
  Button,
  Group,
  ScrollArea,
  Stack,
  Tooltip,
} from "@mantine/core";
import { type MethodApi, useRunPlugin } from "@ocelescope/api-base";
import { OcelSelect } from "@ocelescope/core";
import { PluginForm } from "@ocelescope/plugin-components";
import { ResourceSelect } from "@ocelescope/resources";
import type Form from "@rjsf/core";
import { EyeClosedIcon, EyeIcon } from "lucide-react";
import { useCallback, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

type PluginInputProps = {
  pluginId: string;
  method: MethodApi;
  onSuccess: (taskId: string) => void;
  autoShowFirstOutput: boolean;
  setAutoShowFirstOutput: (value: boolean) => void;
};

export type PluginInputType = {
  input_resources: { [key: string]: string };
  input: any;
};

const compact = (record: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => !!value),
  ) as Record<string, string>;

const PluginInput: React.FC<PluginInputProps> = ({
  pluginId,
  method,
  onSuccess,
  autoShowFirstOutput,
  setAutoShowFirstOutput,
}) => {
  const { mutate: runPlugin } = useRunPlugin({
    mutation: { onSuccess },
  });

  const defaultValue = {
    input_resources: Object.fromEntries(
      method.inputs.map(({ name }) => [name, undefined]),
    ),
    formData: {},
  };

  const { control, handleSubmit } = useForm<PluginInputType>({
    defaultValues: defaultValue,
  });

  const ref = useRef<Form>(null);

  const onSubmit = useCallback(() => {
    if (!method.configuration_schema || ref.current?.validateForm()) {
      handleSubmit(({ input_resources, input }) =>
        runPlugin({
          data: {
            input_resources: compact(input_resources),
            input,
          },
          methodName: method.name,
          pluginId,
        }),
      )();
    }
  }, [handleSubmit, pluginId, method, runPlugin]);

  const inputResources = useWatch({ control, name: "input_resources" });

  return (
    <Stack gap={0} flex={1} mih={0}>
      <ScrollArea flex={1} mih={0} type="auto">
        <Stack gap="md" px="md" pb="md" maw={640} mx="auto" w="100%">
          {method.inputs.map((io) => (
            <Controller
              key={io.name}
              control={control}
              name={`input_resources.${io.name}`}
              rules={
                !io.is_optional ? { required: "Please select a value" } : {}
              }
              render={({ field, fieldState }) =>
                io.type === "ocel" ? (
                  <OcelSelect
                    label={io.label}
                    clearable={io.is_optional}
                    required={!io.is_optional}
                    description={io.description}
                    searchable
                    error={fieldState.error?.message}
                    onChange={field.onChange}
                    value={field.value}
                  />
                ) : (
                  <ResourceSelect
                    clearable={io.is_optional}
                    label={io.label}
                    required={!io.is_optional}
                    type={io.schema_id}
                    description={io.description}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    value={field.value}
                    searchable
                  />
                )
              }
            />
          ))}
          {method.configuration_schema && (
            <Controller
              control={control}
              name="input"
              render={({ field }) => (
                <PluginForm
                  ref={ref}
                  pluginId={pluginId}
                  methodName={method.name}
                  schema={method.configuration_schema as { [key: string]: any }}
                  inputResources={inputResources}
                  formData={field.value}
                  onChange={({ formData }) => field.onChange(formData)}
                  uiSchema={{ "ui:submitButtonOptions": { norender: true } }}
                  onSubmit={onSubmit}
                />
              )}
            />
          )}
        </Stack>
      </ScrollArea>
      <Group gap="xs" wrap="nowrap" p="md" maw={640} mx="auto" w="100%">
        <Button flex={1} onClick={onSubmit}>
          Submit
        </Button>
        <Tooltip
          label={
            autoShowFirstOutput
              ? "Opening first output after run"
              : "Hide outputs after run"
          }
          withArrow
        >
          <ActionIcon
            onClick={() => setAutoShowFirstOutput(!autoShowFirstOutput)}
            size="input-sm"
            variant={autoShowFirstOutput ? "light" : "default"}
            aria-label="Open first output after run"
            aria-pressed={autoShowFirstOutput}
          >
            {autoShowFirstOutput ? (
              <EyeIcon size={18} />
            ) : (
              <EyeClosedIcon size={18} />
            )}
          </ActionIcon>
        </Tooltip>
      </Group>
    </Stack>
  );
};

export default PluginInput;
