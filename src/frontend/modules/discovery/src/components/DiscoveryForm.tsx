import { Input, MultiSelect, NumberInput, Select, Slider } from "@mantine/core";
import type { FieldProps, FieldTemplateProps, WidgetProps } from "@rjsf/utils";
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
}: WidgetProps) => {
  const min = (schema.minimum ?? schema.exclusiveMinimum) as number;
  const max = (schema.maximum ?? schema.exclusiveMaximum) as number;
  const description = schema.description;
  return (
    <>
      <Input.Label required={required}>{label}</Input.Label>
      {description && <Input.Description>{description}</Input.Description>}
      <NumberInput
        mt={"5px"}
        min={min}
        max={max}
        step={0.0001}
        decimalScale={4}
        hideControls
        value={
          typeof value === "number"
            ? value
            : ((schema.default as number) ?? min)
        }
        onChange={(v) => typeof v === "number" && onChange(v)}
      />
      <Slider
        min={min}
        max={max}
        step={0.0001}
        label={(v) => v.toFixed(4)}
        value={
          typeof value === "number"
            ? value
            : ((schema.default as number) ?? min)
        }
        onChange={onChange}
      />
    </>
  );
};

const WIDGETS = { "mantine-slider": MantineSliderWidget };

const FieldTemplate = ({
  children,
  errors,
  help,
  hidden,
}: FieldTemplateProps) => {
  if (hidden) return <div style={{ display: "none" }}>{children}</div>;
  return (
    <div>
      {children}
      {errors}
      {help}
    </div>
  );
};

const TEMPLATES = { FieldTemplate };

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
      (prop.minimum !== undefined || prop.exclusiveMinimum !== undefined) &&
      (prop.maximum !== undefined || prop.exclusiveMaximum !== undefined)
    ) {
      uiSchema[key] = { "ui:widget": "mantine-slider" };
    }
  }
  return uiSchema;
};

const makeOcelFields = (
  eventTypeOptions: string[],
  objectTypeOptions: string[],
) => {
  const OcelTypeField = (options: string[]) =>
    memo(
      ({
        schema,
        formData,
        onChange,
        required,
        fieldPathId: { path },
      }: FieldProps) => {
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
      },
    );

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
      schema={{ ...schema, title: "" } as Record<string, any>}
      formData={formData}
      validator={validator}
      uiSchema={uiSchema}
      fields={fields}
      widgets={WIDGETS}
      templates={TEMPLATES}
      onChange={(data) =>
        onChange((data.formData as Record<string, unknown>) ?? {})
      }
    />
  );
};
