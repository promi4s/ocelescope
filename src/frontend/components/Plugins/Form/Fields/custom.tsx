import { Control, useWatch } from "react-hook-form";
import { PluginInputType } from "..";
import { memo } from "react";
import { FieldProps } from "@rjsf/utils";
import { useGetComputedValues } from "@/api/fastapi/plugins/plugins";
import { keepPreviousData } from "@tanstack/react-query";
import { MultiSelect, Select } from "@mantine/core";

type useSelectOptionsProps = {
  pluginId: string;
  methodName: string;
  provider: string;
  control: Control<PluginInputType>;
};

export const useSelectOptions = ({
  pluginId,
  methodName,
  provider,
  control,
}: useSelectOptionsProps) => {
  // TODO: Maybe use subscribe?
  const formValues = useWatch({ control });

  const { data } = useGetComputedValues(
    pluginId,
    methodName,
    provider,
    {
      input: formValues.input,
      input_ocels: Object.fromEntries(
        Object.entries(formValues.input_ocels ?? {}).filter(
          ([_, v]) => !!v && v.length >= 0,
        ),
      ) as PluginInputType["input_ocels"],
      input_resources: Object.fromEntries(
        Object.entries(formValues.input_resources ?? {}).filter(
          ([_, v]) => !!v && v.length >= 0,
        ),
      ) as PluginInputType["input_resources"],
    },
    {
      query: {
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  );

  return { options: data };
};

export const getComputedSelect = ({
  pluginId,
  methodName,
  control,
}: {
  pluginId: string;
  methodName: string;
  control: Control<PluginInputType>;
}) => ({
  computed_select: memo(
    ({ schema, required, formData, onChange }: FieldProps) => {
      const meta = schema?.["x-ui-meta"] as {
        provider: string;
      };
      const SelectComponent = schema.type === "array" ? MultiSelect : Select;

      const { options } = useSelectOptions({
        pluginId,
        methodName,
        control,
        provider: meta.provider,
      });

      return (
        <SelectComponent
          label={schema.title}
          description={schema.description}
          required={required}
          value={formData}
          onChange={onChange as (value: any) => void}
          data={options}
        />
      );
    },
  ),
});
