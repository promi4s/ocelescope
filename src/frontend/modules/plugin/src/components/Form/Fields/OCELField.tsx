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
import { type ComponentType, memo, useEffect, useMemo, useState } from "react";
import { useOcelId } from "../PluginFormContext";

type OcelSelectProps = {
  ocelId: string;
  isMulti: boolean;
  value: any;
  onChange: (value: any) => void;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
};

const AttributeSelect =
  (
    useAttributes: typeof useObjectAttributes | typeof useEventAttributes,
  ): React.FC<OcelSelectProps> =>
  ({ ocelId, isMulti, value, ...props }) => {
    const { data: attributes } = useAttributes(ocelId);

    const names = useMemo(
      () => [...new Set((attributes ?? []).map(({ name }) => name))],
      [attributes],
    );

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value ?? (isMulti ? [] : null)}
        {...props}
        data={names}
        disabled={!ocelId}
        clearable
      />
    );
  };

const TypeSelect =
  (
    useCounts: typeof useEventCounts | typeof useObjectCounts,
  ): React.FC<OcelSelectProps> =>
  ({ ocelId, isMulti, value, ...props }) => {
    const { data: counts } = useCounts(ocelId);

    const types = useMemo(() => Object.keys(counts ?? {}), [counts]);

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        {...props}
        value={value ?? (isMulti ? [] : null)}
        data={types}
        clearable
      />
    );
  };

const IdSelect =
  (
    useIds: typeof useEventIds | typeof useObjectIds,
  ): React.FC<OcelSelectProps> =>
  ({ ocelId, isMulti, value, ...props }) => {
    const [search, setSearch] = useState<string | undefined>();
    const [debouncedSearch] = useDebouncedValue(search, 300);

    const { data: ids } = useIds(ocelId, { search: debouncedSearch });

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        {...props}
        value={value ?? (isMulti ? [] : null)}
        data={ids?.response}
        searchValue={search}
        onSearchChange={setSearch}
        searchable
      />
    );
  };

const OCEL_FIELDS: Record<string, ComponentType<OcelSelectProps>> = {
  event_type: TypeSelect(useEventCounts),
  object_type: TypeSelect(useObjectCounts),
  event_attribute: AttributeSelect(useEventAttributes),
  object_attribute: AttributeSelect(useObjectAttributes),
  event_id: IdSelect(useEventIds),
  object_id: IdSelect(useObjectIds),
};

export const OCELField = memo(
  ({
    schema,
    required,
    formData,
    onChange,
    fieldPathId: { path },
  }: FieldProps) => {
    const ocelRef = schema["x-ui-meta"]?.["ocel_id"];
    const ocelFieldType = schema["x-ui-meta"]?.["field_type"];

    const ocelId = useOcelId(ocelRef);
    const isMulti = schema.type === "array";

    useEffect(() => {
      onChange(isMulti ? [] : undefined, path);
    }, [ocelId, isMulti, onChange, path]);

    const Selector = OCEL_FIELDS[ocelFieldType];

    return (
      Selector && (
        <Selector
          key={ocelId}
          ocelId={ocelId}
          isMulti={isMulti}
          value={formData}
          onChange={(value) => onChange(value, path)}
          label={schema.title}
          description={schema.description}
          disabled={!ocelId}
          required={required}
        />
      )
    );
  },
);
