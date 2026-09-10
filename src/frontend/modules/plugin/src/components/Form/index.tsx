import { Button, Stack } from "@mantine/core";
import { type MethodApi, useRunPlugin } from "@ocelescope/api-base";
import { OcelSelect } from "@ocelescope/core";
import { PluginForm } from "@ocelescope/plugin-form";
import { ResourceSelect } from "@ocelescope/resources";
import { useCallback } from "react";
import { type Control, Controller, useForm, useWatch } from "react-hook-form";

type PluginInputProps = {
  pluginId: string;
  method: MethodApi;
  onSuccess: (taskId: string) => void;
};

export type PluginInputType = {
  input_resources: { [key: string]: string };
  input: any;
};

const compact = (record: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => !!value),
  ) as Record<string, string>;

type ConfigurationSectionProps = {
  control: Control<PluginInputType>;
  schema: { [key: string]: any };
  pluginId: string;
  methodName: string;
  onSubmit: () => void;
};

const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  control,
  schema,
  pluginId,
  methodName,
  onSubmit,
}) => {
  const inputResources = useWatch({ control, name: "input_resources" });

  return (
    <Controller
      control={control}
      name="input"
      render={({ field }) => (
        <PluginForm
          pluginId={pluginId}
          methodName={methodName}
          schema={schema}
          inputResources={inputResources}
          value={field.value}
          onChange={field.onChange}
          onSubmit={onSubmit}
        />
      )}
    />
  );
};

const PluginInput: React.FC<PluginInputProps> = ({
  pluginId,
  method,
  onSuccess,
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

  const onSubmit = useCallback(
    () =>
      handleSubmit(({ input_resources, input }) =>
        runPlugin({
          data: {
            input_resources: compact(input_resources),
            input,
          },
          methodName: method.name,
          pluginId,
        }),
      )(),
    [handleSubmit, pluginId, method, runPlugin],
  );

  return (
    <Stack gap={"md"}>
      {method.inputs.map((io) => (
        <Controller
          key={io.name}
          control={control}
          name={`input_resources.${io.name}`}
          rules={!io.is_optional ? { required: "Please select a value" } : {}}
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
      {method.configuration_schema ? (
        <ConfigurationSection
          control={control}
          pluginId={pluginId}
          methodName={method.name}
          schema={method.configuration_schema}
          onSubmit={onSubmit}
        />
      ) : (
        <Button onClick={onSubmit}>Submit</Button>
      )}
    </Stack>
  );
};

export default PluginInput;
