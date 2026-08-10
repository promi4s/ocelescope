import { MultiSelect, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  type BodyGetComputedValues,
  useGetComputedValues,
} from "@ocelescope/api-base";
import type { FieldProps } from "@rjsf/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { useWatch } from "react-hook-form";
import { usePluginForm } from "../PluginFormContext";

const compact = (record: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => !!value),
  ) as Record<string, string>;

export const useSelectOptions = (provider: string) => {
  const { pluginId, methodName, control } = usePluginForm();

  const formValues = useWatch({ control });

  const serializedBody = useMemo(
    () =>
      JSON.stringify({
        input: formValues.input,
        input_ocels: compact(formValues.input_ocels),
        input_resources: compact(formValues.input_resources),
      }),
    [formValues],
  );
  const [debouncedBody] = useDebouncedValue(serializedBody, 300);

  const body = useMemo(
    () => JSON.parse(debouncedBody) as BodyGetComputedValues,
    [debouncedBody],
  );

  const { data } = useGetComputedValues(pluginId, methodName, provider, body, {
    query: {
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  return { options: data };
};

export const ComputedSelect = memo(
  ({
    schema,
    required,
    formData,
    onChange,
    fieldPathId: { path },
  }: FieldProps) => {
    const meta = schema["x-ui-meta"] as {
      provider: string;
    };

    const isMulti = schema.type === "array";
    const SelectComponent = isMulti ? MultiSelect : Select;

    const { options } = useSelectOptions(meta.provider);

    return (
      <SelectComponent
        label={schema.title}
        description={schema.description}
        required={required}
        value={formData ?? (isMulti ? [] : null)}
        onChange={(value) => onChange(value, path)}
        data={options}
      />
    );
  },
);
