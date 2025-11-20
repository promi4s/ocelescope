import {
  useEventAttributes,
  useEventCounts,
  useEventIds,
  useObjectAttributes,
  useObjectCount,
  useObjectIds,
} from "@/api/fastapi/ocels/ocels";
import { MultiSelect, Select } from "@mantine/core";
import type { FieldProps } from "@rjsf/utils";
import { type Control, useWatch } from "react-hook-form";
import type { PluginInputType } from "..";
import type React from "react";
import { memo, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";

type OcelFieldProps = {
  value: any;
  isMulti: boolean;
  onChange: (data: any) => void;
  ocelId: string;
  label?: string;
  description?: string;
  requiered?: boolean;
};

const AttributeSelector: (
  query: typeof useObjectAttributes | typeof useEventAttributes,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ isMulti, ocelId, onChange, value, label, requiered, description }) => {
    const { data: attributes = {} } = query({ ocel_id: ocelId });
    const attributeNames = new Set(
      Object.values(attributes).flatMap((attributes) =>
        attributes.map((attribute) => attribute.attribute),
      ),
    );

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value}
        label={label}
        onChange={onChange}
        required={requiered}
        description={description}
        clearable
        data={[...attributeNames]}
      />
    );
  };

const TypeSelector: (
  query: typeof useEventCounts | typeof useObjectCount,
) => React.FC<OcelFieldProps> =
  (query) =>
  ({ ocelId, onChange, requiered, value, isMulti, label, description }) => {
    const { data = {} } = query({ ocel_id: ocelId });

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value}
        label={label}
        required={requiered}
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
  ({ ocelId, isMulti, ...rest }) => {
    const [searchValue, setSearchValue] = useState<undefined | string>();
    const [debouncedSearch] = useDebouncedValue(searchValue, 300);

    const { data: ids } = query({
      ocel_id: ocelId,
      search: debouncedSearch,
    });

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        searchable
        searchValue={searchValue}
        onSearchChange={(newSearchValue) => setSearchValue(newSearchValue)}
        data={ids?.response}
        {...rest}
      />
    );
  };

const ocelFieldMap: Record<string, React.FC<OcelFieldProps>> = {
  event_type: TypeSelector(useEventCounts),
  object_type: TypeSelector(useObjectCount),
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
          requiered={required}
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
