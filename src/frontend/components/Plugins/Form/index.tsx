import { PluginMethod } from "@/api/fastapi-schemas";
import { Button, Stack } from "@mantine/core";
import OcelSelect from "@/components/OcelSelect/OcelSelect";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useGetOcels } from "@/api/fastapi/ocels/ocels";
import { useMemo } from "react";
import { useRunPlugin } from "@/api/fastapi/plugins/plugins";
import PluginForm from "./PluginForm";

type PluginInputProps = {
  pluginName: string;
  pluginVersion: string;
  pluginMethod: PluginMethod;
  onSuccess: (taskId: string) => void;
};
const PluginInput: React.FC<PluginInputProps> = ({
  pluginMethod,
  pluginName,
  pluginVersion,
  onSuccess,
}) => {
  const { data } = useGetOcels();

  const { mutate } = useRunPlugin({ mutation: { onSuccess } });
  const defaultValue = Object.fromEntries(
    pluginMethod.input_ocels.map(({ name }) => [name, ""]),
  );
  const autofilledDefaultValue = useMemo(
    () =>
      data?.current_ocel_id
        ? Object.fromEntries(
            pluginMethod.input_ocels.map(({ name }) => [
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
        {(pluginMethod.input_ocels ?? []).map(
          ({ name, label, description }) => (
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
      {pluginMethod.input_model &&
        !Object.values(ocelValues).some((id) => !id) && (
          <PluginForm
            schema={pluginMethod.input_model}
            ocelContext={ocelValues as Record<string, string>}
            onSubmit={(formData) => {}}
          />
        )}
      {!pluginMethod.input_model && (
        <Button
          onClick={() =>
            handleSubmit((data) => {
              mutate({
                name: pluginName,
                version: pluginVersion,
                method: pluginMethod.name,
                data: {
                  input_ocels: data as Record<string, string>,
                },
              });
            })()
          }
        >
          Run
        </Button>
      )}
    </>
  );
};

export default PluginInput;
