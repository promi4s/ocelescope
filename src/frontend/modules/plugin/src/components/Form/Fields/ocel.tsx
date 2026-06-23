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
import type { FieldProps } from "@rjsf/utils";
import type React from "react";
import { memo, useState } from "react";
import { type Control, useWatch } from "react-hook-form";
import type { PluginInputType } from "..";

type OcelFieldProps = {
  value: any;
  isMulti: boolean;
  onChange: (data: any) => void;
  ocelId: string;
  label?: string;
  description?: string;
  required?: boolean;
};

const AttributeSelector: (
  query: typeof useObjectAttributes | typeof useEventAttributes,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ isMulti, ocelId, onChange, value, label, required, description }) => {
    const { data: attributes = [] } = query(ocelId);
    const attributeNames = new Set(attributes.map(({ name }) => name));

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value ?? (isMulti ? [] : null)}
        label={label}
        onChange={onChange}
        required={required}
        description={description}
        clearable
        data={[...attributeNames]}
      />
    );
  };

const TypeSelector: (
  query: typeof useEventCounts | typeof useObjectCounts,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ ocelId, onChange, required, value, isMulti, label, description }) => {
    const { data = {} } = query(ocelId);

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value ?? (isMulti ? [] : null)}
        label={label}
        required={required}
        clearable
        description={description}
        onChange={onChange}
        data={Object.keys(data)}
      />
    );
  };

const IdSelect: (
  query: typeof useEventIds | typeof useObjectIds,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ ocelId, isMulti, value, ...rest }) => {
    const [searchValue, setSearchValue] = useState<undefined | string>();
    const [debouncedSearch] = useDebouncedValue(searchValue, 300);

    const { data: ids } = query(ocelId, {
      search: debouncedSearch,
    });

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        searchable
        searchValue={searchValue}
        onSearchChange={(newSearchValue) => setSearchValue(newSearchValue)}
        data={ids?.response}
        value={value ?? (isMulti ? [] : null)}
        {...rest}
      />
    );
  };

const ocelFieldMap: Record<string, React.FC<OcelFieldProps>> = {
  event_type: TypeSelector(useEventCounts),
  object_type: TypeSelector(useObjectCounts),
  event_attribute: AttributeSelector(useEventAttributes),
  object_attribute: AttributeSelector(useObjectAttributes),
  event_id: IdSelect(useEventIds),
  object_id: IdSelect(useObjectIds),
};

export const wrapFieldsWithContext = (control: Control<PluginInputType>) => {
  const wrapped: Record<string, React.FC<FieldProps>> = {};

  for (const [name, Field] of Object.entries(ocelFieldMap)) {
    const Comp: React.FC<FieldProps> = ({
      schema,
      required,
      formData,
      fieldPathId: { path },
      onChange,
    }) => {
      const ocelRef = schema?.["x-ui-meta"]?.ocel_id;
      const isMulti = schema?.type === "array";
      const ocelId = useWatch({ control, name: `input_ocels.${ocelRef}` });

      return (
        <Field
          label={schema?.title}
          required={required}
          description={schema?.description}
          isMulti={isMulti}
          onChange={(data) => onChange(data, path)}
          value={formData}
          ocelId={ocelId}
        />
      );
    };

    wrapped[name] = memo(Comp);
  }

  return wrapped;
};
