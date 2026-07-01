import { MultiSelect, NumberInput, Select, Slider, Stack, Text } from "@mantine/core";
import type { FieldProps, WidgetProps } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type { DiscoverySchema } from "../types";

const Form = dynamic(() => import("@rjsf/mantine").then((m) => m.Form), {
  ssr: false,
});

const MantineSliderWidget = ({
  value,
  onChange,
  schema,
  label,
  required,
  description,
}: WidgetProps) => {
  const min = schema.minimum as number;
  const max = schema.maximum as number;
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {label}
        {required && " *"}
      </Text>
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}
      <NumberInput
        min={min}
        max={max}
        step={0.0001}
        decimalScale={4}
        hideControls
        value={typeof value === "number" ? value : ((schema.default as number) ?? min)}
        onChange={(v) => typeof v === "number" && onChange(v)}
      />
      <Slider
        min={min}
        max={max}
        step={0.0001}
        label={(v) => v.toFixed(4)}
        value={typeof value === "number" ? value : ((schema.default as number) ?? min)}
        onChange={onChange}
      />
    </Stack>
  );
};

const WIDGETS = { "mantine-slider": MantineSliderWidget };

const UI_SCHEMA_BASE = {
  "ui:submitButtonOptions": { norender: true },
};

const buildUiSchema = (schema: DiscoverySchema) => {
  const uiSchema: Record<string, unknown> = { ...UI_SCHEMA_BASE };
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (prop.fieldType) {
      uiSchema[key] = { "ui:field": prop.fieldType };
    } else if (
      (prop.type === "number" || prop.type === "integer") &&
      prop.minimum !== undefined &&
      prop.maximum !== undefined
    ) {
      uiSchema[key] = { "ui:widget": "mantine-slider" };
    }
  }
  return uiSchema;
};

const makeOcelFields = (eventTypeOptions: string[], objectTypeOptions: string[]) => {
  const OcelTypeField =
    (options: string[]) =>
    memo(({ schema, formData, onChange, required, fieldPathId: { path } }: FieldProps) => {
      const Component = schema.type === "array" ? MultiSelect : Select;
      return (
        <Component
          label={schema.title}
          description={schema.description}
          required={required}
          value={formData ?? (schema.type === "array" ? [] : null)}
          onChange={(v) => onChange(v, path)}
          data={options}
          clearable
          searchable
        />
      );
    });

  return {
    event_type: OcelTypeField(eventTypeOptions),
    object_type: OcelTypeField(objectTypeOptions),
  };
};

type DiscoveryFormProps = {
  schema: DiscoverySchema;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  eventTypeOptions: string[];
  objectTypeOptions: string[];
};

export const DiscoveryForm = ({
  schema,
  formData,
  onChange,
  eventTypeOptions,
  objectTypeOptions,
}: DiscoveryFormProps) => {
  const uiSchema = useMemo(() => buildUiSchema(schema), [schema]);
  const fields = useMemo(
    () => makeOcelFields(eventTypeOptions, objectTypeOptions),
    [eventTypeOptions, objectTypeOptions],
  );

  return (
    <Form
      schema={{ ...schema, title: "" }}
      formData={formData}
      validator={validator}
      uiSchema={uiSchema}
      fields={fields}
      widgets={WIDGETS}
      onChange={(data) => onChange((data.formData as Record<string, unknown>) ?? {})}
    />
  );
};
