import { PluginMethod } from "@/api/fastapi-schemas";
import { Button, Stack } from "@mantine/core";
import OcelSelect from "@/components/OcelSelect/OcelSelect";
import { Controller, useForm } from "react-hook-form";
import PluginForm from "./PluginForm";
import { useRunPlugin } from "@/api/fastapi/plugins/plugins";
import ResourceSelect from "@/components/Resources/ResourceSelect";
import { useCallback } from "react";

type PluginInputProps = {
  pluginId: string;
  method: PluginMethod;
  onSuccess: (taskId: string) => void;
};

export type PluginInputType = {
  input_ocels: { [key: string]: string };
  input_resources: { [key: string]: string };
  input: any;
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
    input_ocels: Object.fromEntries(
      Object.keys(method.input_ocels ?? {}).map((name) => [name, undefined]),
    ),
    input_resources: Object.fromEntries(
      Object.keys(method.input_resources ?? {}).map((name) => [
        name,
        undefined,
      ]),
    ),
    formData: {},
  };

  const { control, handleSubmit } = useForm<PluginInputType>({
    defaultValues: defaultValue,
  });

  const onSubmit = useCallback(
    handleSubmit((data) =>
      runPlugin({ data, methodName: method.name, pluginId }),
    ),
    [handleSubmit, pluginId, method.name],
  );

  return (
    <>
      <Stack gap={"md"}>
        {Object.entries(method.input_ocels ?? {}).map(
          ([name, { label, description, extension }]) => (
            <Controller
              control={control}
              name={`input_ocels.${name}`}
              rules={{ required: "Please select a value" }}
              render={({ field, fieldState }) => (
                <OcelSelect
                  label={label}
                  required
                  extension={extension ?? undefined}
                  description={description}
                  error={fieldState.error?.message}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
          ),
        )}
        {Object.entries(method.input_resources ?? {}).map(
          ([name, [resource_type, { label, description }]]) => (
            <Controller
              control={control}
              name={`input_resources.${name}`}
              rules={{ required: "Please select a value" }}
              render={({ field, fieldState }) => (
                <ResourceSelect
                  label={label}
                  required
                  type={resource_type}
                  description={description}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  value={field.value}
                />
              )}
            />
          ),
        )}
        {method.input_schema ? (
          <PluginForm
            pluginId={pluginId}
            methodName={method.name}
            schema={method.input_schema}
            control={control}
            onSubmit={onSubmit}
          />
        ) : (
          <Button onClick={onSubmit}>Submit</Button>
        )}
      </Stack>
    </>
  );
};

export default PluginInput;
