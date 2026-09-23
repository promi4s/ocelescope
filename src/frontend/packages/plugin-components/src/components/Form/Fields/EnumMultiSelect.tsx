import { MultiSelect } from "@mantine/core";
import type { FieldProps, Registry, RJSFSchema } from "@rjsf/utils";
import { memo, useMemo } from "react";

const itemsOf = (
  schema: RJSFSchema,
  registry: Registry,
): RJSFSchema | undefined => {
  const { items } = schema;

  if (!items || typeof items === "boolean" || Array.isArray(items)) {
    return undefined;
  }

  return registry.schemaUtils.retrieveSchema(items as RJSFSchema);
};

export const isStringEnumArray = (schema: RJSFSchema, registry: Registry) => {
  if (schema.type !== "array") {
    return false;
  }

  const enumValues = itemsOf(schema, registry)?.enum;

  return (
    Array.isArray(enumValues) &&
    enumValues.length > 0 &&
    enumValues.every((value) => typeof value === "string")
  );
};

export const EnumMultiSelect = memo(
  ({
    schema,
    registry,
    required,
    formData,
    onChange,
    rawErrors,
    disabled,
    readonly,
    fieldPathId: { path },
  }: FieldProps) => {
    const options = useMemo(
      () => (itemsOf(schema, registry)?.enum ?? []) as string[],
      [schema, registry],
    );

    return (
      <MultiSelect
        label={schema.title}
        description={schema.description}
        required={required}
        error={rawErrors?.[0]}
        data={options}
        value={Array.isArray(formData) ? formData : []}
        onChange={(value) => onChange(value, path)}
        disabled={disabled || readonly}
        clearable
        searchable
      />
    );
  },
);
