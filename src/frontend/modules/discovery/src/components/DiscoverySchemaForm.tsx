import RefParser from "@apidevtools/json-schema-ref-parser";
import { MultiSelect, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  useEventAttributes,
  useEventCounts,
  useEventIds,
  useObjectAttributes,
  useObjectCounts,
  useObjectIds,
} from "@ocelescope/api-base";
import { useCurrentOcel } from "@ocelescope/core";
import dynamic from "next/dynamic";
import type { FieldProps, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { unflatten } from "flat";
import traverse from "json-schema-traverse";
import { memo, useEffect, useMemo, useState } from "react";

const Form = dynamic(() => import("@rjsf/mantine").then((m) => m.Form), {
  ssr: false,
});

type Schema = Record<string, unknown>;

type DiscoverySchemaFormProps = {
  schema: Schema;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  onSubmit: (data: Record<string, unknown>) => void;
};

type OcelFieldProps = {
  value: unknown;
  isMulti: boolean;
  onChange: (data: unknown) => void;
  label?: string;
  description?: string;
  required?: boolean;
};

export const buildUiSchema = async ({ schema }: { schema: Schema }) => {
  const deref = await RefParser.dereference(schema as never, {
    dereference: { circular: "ignore" },
  });

  const uiSchema: UiSchema = {};

  traverse(deref, {
    allKeys: true,
    cb: (subschema, pointer) => {
      const pointerComponents = pointer.split("/").slice(1);

      if (pointerComponents[0] !== "properties") {
        return;
      }

      if (
        pointerComponents[0] === "properties" &&
        pointerComponents.at(-1) === "x-ui-meta"
      ) {
        const path = pointerComponents
          .filter(
            (pathComponent) =>
              !["x-ui-meta", "properties"].includes(pathComponent),
          )
          .join(".");

        uiSchema[path] = {
          "ui:field": subschema["field_type"] ?? subschema["type"],
        };
      }
    },
  });

  return unflatten(uiSchema);
};

const AttributeSelector: (
  query: typeof useObjectAttributes | typeof useEventAttributes,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ isMulti, onChange, value, label, required, description }) => {
    const { id: ocelId } = useCurrentOcel();
    const { data: attributes = [] } = query(ocelId);
    const attributeNames = [...new Set(attributes.map(({ name }) => name))];
    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value as string[] & string}
        label={label}
        onChange={onChange as (value: string[] | string | null) => void}
        required={required}
        description={description}
        clearable
        data={attributeNames}
      />
    );
  };

const TypeSelector: (
  query: typeof useEventCounts | typeof useObjectCounts,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ onChange, required, value, isMulti, label, description }) => {
    const { id: ocelId } = useCurrentOcel();
    const { data = {} } = query(ocelId);
    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value as string[] & string}
        label={label}
        required={required}
        clearable
        description={description}
        onChange={onChange as (value: string[] | string | null) => void}
        data={Object.keys(data)}
      />
    );
  };

const IdSelector: (
  query: typeof useEventIds | typeof useObjectIds,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ isMulti, onChange, value, label, required, description }) => {
    const { id: ocelId } = useCurrentOcel();
    const [searchValue, setSearchValue] = useState<string>();
    const [debouncedSearch] = useDebouncedValue(searchValue, 300);
    const { data: ids } = query(ocelId, { search: debouncedSearch });
    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value as string[] & string}
        label={label}
        required={required}
        description={description}
        searchable
        clearable
        searchValue={searchValue}
        onSearchChange={(newValue) => setSearchValue(newValue)}
        onChange={onChange as (value: string[] | string | null) => void}
        data={ids?.response}
      />
    );
  };

const currentOcelFieldMap: Record<string, React.FC<OcelFieldProps>> = {
  event_type: TypeSelector(useEventCounts),
  object_type: TypeSelector(useObjectCounts),
  event_attribute: AttributeSelector(useEventAttributes),
  object_attribute: AttributeSelector(useObjectAttributes),
  event_id: IdSelector(useEventIds),
  object_id: IdSelector(useObjectIds),
};

const buildFields = () => {
  const fields: Record<string, React.FC<FieldProps>> = {};

  for (const [name, FieldComponent] of Object.entries(currentOcelFieldMap)) {
    const WrappedField: React.FC<FieldProps> = ({
      schema,
      required,
      formData,
      fieldPathId: { path },
      onChange,
    }) => {
      const isMulti = schema?.type === "array";

      return (
        <FieldComponent
          label={schema?.title}
          description={schema?.description}
          required={required}
          isMulti={isMulti}
          value={formData}
          onChange={(value) => onChange(value, path)}
        />
      );
    };

    fields[name] = memo(WrappedField);
  }

  return fields;
};

export const DiscoverySchemaForm: React.FC<DiscoverySchemaFormProps> = ({
  schema,
  formData,
  onChange,
  onSubmit,
}) => {
  const [uiSchema, setUiSchema] = useState<UiSchema>();
  const fields = useMemo(() => buildFields(), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ui = await buildUiSchema({ schema });
      if (!cancelled) {
        setUiSchema(ui as UiSchema);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schema]);

  return (
    <Form
      schema={{ ...schema, title: "" }}
      formData={formData}
      validator={validator}
      uiSchema={uiSchema}
      fields={fields}
      onChange={(event) =>
        onChange((event.formData ?? {}) as Record<string, unknown>)
      }
      onSubmit={(event) =>
        onSubmit((event.formData ?? {}) as Record<string, unknown>)
      }
    />
  );
};
