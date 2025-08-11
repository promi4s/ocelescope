import { PluginMethod } from "@/api/fastapi-schemas";
import { Stack } from "@mantine/core";
import OcelSelect from "@/components/OcelSelect/OcelSelect";
import { Controller, useForm } from "react-hook-form";
import PluginForm from "./PluginForm";
import { useRunPlugin } from "@/api/fastapi/plugins/plugins";
import ResourceSelect from "@/components/Resources/ResourceSelect";

type PluginInputProps = {
  name: string;
  version: string;
  method: PluginMethod;
  onSuccess: (taskId: string) => void;
};

export type PluginInputType = {
  input_ocels: { [key: string]: string };
  input_resources: { [key: string]: string };
  input: any;
};

const PluginInput: React.FC<PluginInputProps> = ({
  name,
  method,
  onSuccess,
}) => {
  const { mutate: runPlugin } = useRunPlugin({
    mutation: { onSuccess },
  });

  const defaultValue = {
    input_ocels: Object.fromEntries(
      Object.keys(method.input_ocels ?? {}).map((name) => [name, ""]),
    ),
    input_resources: Object.fromEntries(
      Object.keys(method.input_resources ?? {}).map((name) => [name, ""]),
    ),
    formData: undefined,
  };

  const { control, handleSubmit } = useForm<PluginInputType>({
    defaultValues: defaultValue,
  });

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
      </Stack>
      <PluginForm
        schema={method.input_schema}
        control={control}
        onSubmit={handleSubmit((data) =>
          runPlugin({ data, methodName: method.name, pluginName: name }),
        )}
      />
    </>
  );
};

export default PluginInput;
