import { PluginMethod } from "@/api/fastapi-schemas";
import { Stack } from "@mantine/core";
import OcelSelect from "@/components/OcelSelect/OcelSelect";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useGetOcels } from "@/api/fastapi/ocels/ocels";
import { useMemo } from "react";
import PluginForm from "./PluginForm";
import { useRunPlugin } from "@/api/fastapi/plugins/plugins";

type PluginInputProps = {
  name: string;
  version: string;
  method: PluginMethod;
  onSuccess: (taskId: string) => void;
};
const PluginInput: React.FC<PluginInputProps> = ({
  method,
  name,
  version,
  onSuccess,
}) => {
  const { data } = useGetOcels();

  const { mutate: runPlugin } = useRunPlugin();

  const defaultValue = Object.fromEntries(
    Object.keys(method.input_ocels ?? {}).map((name) => [name, ""]),
  );

  const autofilledDefaultValue = useMemo(
    () =>
      data?.current_ocel_id
        ? Object.fromEntries(
            Object.keys(method.input_ocels ?? {}).map((name) => [
              name,
              data.current_ocel_id,
            ]),
          )
        : undefined,
    [data?.current_ocel_id],
  );

  const { control, handleSubmit } = useForm({
    defaultValues: defaultValue,
    values: autofilledDefaultValue,
  });

  const ocelValues = useWatch({ control });
  return (
    <>
      <Stack gap={0}>
        {Object.entries(method.input_ocels ?? {}).map(
          ([name, { label, description }]) => (
            <Controller
              control={control}
              name={name}
              rules={{ required: true }}
              render={({ field }) => (
                <OcelSelect
                  label={label}
                  required
                  description={description}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
          ),
        )}
      </Stack>
      {method.input_schema && !Object.values(ocelValues).some((id) => !id) && (
        <PluginForm
          schema={method.input_schema}
          ocelContext={ocelValues as Record<string, string>}
          onSubmit={(formData) =>
            handleSubmit((data) =>
              runPlugin({
                methodName: method.name,
                pluginName: name,
                data: {
                  input: formData ?? {},
                  input_ocels: data as Record<string, string>,
                  input_resources: {},
                },
              }),
            )()
          }
        />
      )}
    </>
  );
};

export default PluginInput;
