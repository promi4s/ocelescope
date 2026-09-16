import { MultiSelect, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  useE2oQualifier,
  useEventAttributes,
  useEventCounts,
  useEventIds,
  useO2oQualifier,
  useObjectAttributes,
  useObjectCounts,
  useObjectIds,
} from "@ocelescope/api-base";
import type { FieldProps } from "@rjsf/utils";
import {
  type ComponentType,
  memo,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import type { OcelSelectProps } from "../../types";
import { FrequencyPicker } from "../components/R4pmInputs";
import { usePluginForm } from "../context";

const AttributeSelect =
  (
    useAttributes: typeof useObjectAttributes | typeof useEventAttributes,
  ): React.FC<OcelSelectProps> =>
  ({ ocelId, isMulti, value, onChange, ...props }) => {
    const { data: attributes } = useAttributes(ocelId);

    useEffect(() => {
      onChange(isMulti ? [] : undefined);
    }, [ocelId, isMulti, onChange]);

    const names = useMemo(
      () => [...new Set((attributes ?? []).map(({ name }) => name))],
      [attributes],
    );

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        value={value ?? (isMulti ? [] : null)}
        onChange={onChange}
        {...props}
        data={names}
        disabled={!ocelId}
        clearable
      />
    );
  };

const getDefaultByFrequency = (
  counts: Record<string, number> | undefined,
  isMulti: boolean,
  share: number | undefined,
) => {
  if (!counts || share == null) return undefined;

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  if (!isMulti) return sorted[0]?.[0];

  const target = share * sorted.reduce((sum, [, count]) => sum + count, 0);
  const picked: string[] = [];
  let covered = 0;
  for (const [key, count] of sorted) {
    if (covered >= target) break;
    picked.push(key);
    covered += count;
  }
  return picked;
};

const TypeSelect =
  (
    useCounts: typeof useEventCounts | typeof useObjectCounts,
  ): React.FC<OcelSelectProps> =>
  ({ ocelId, isMulti, value, defaultFrequency, theme, onChange, ...props }) => {
    const { data: counts } = useCounts(ocelId);

    const defaultValue = useMemo(
      () => getDefaultByFrequency(counts, isMulti, defaultFrequency),
      [counts, isMulti, defaultFrequency],
    );

    const applyDefault = useEffectEvent((next: string[] | string | undefined) =>
      onChange(next),
    );

    useEffect(() => {
      applyDefault(defaultValue ?? (isMulti ? [] : undefined));
    }, [defaultValue, isMulti]);

    const types = useMemo(() => Object.keys(counts ?? {}), [counts]);

    if (theme === "r4pm") {
      return (
        <FrequencyPicker
          ocelId={ocelId}
          value={value}
          onChange={onChange}
          isMulti={isMulti}
          {...props}
          items={counts ?? {}}
        />
      );
    }

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        {...props}
        value={value ?? (isMulti ? [] : null)}
        onChange={onChange}
        data={types}
        clearable
        searchable
      />
    );
  };

const IdSelect =
  (
    useIds: typeof useEventIds | typeof useObjectIds,
  ): React.FC<OcelSelectProps> =>
  ({ ocelId, isMulti, value, onChange, ...props }) => {
    const [search, setSearch] = useState<string | undefined>();
    const [debouncedSearch] = useDebouncedValue(search, 300);

    const { data: ids } = useIds(ocelId, { search: debouncedSearch });

    useEffect(() => {
      onChange(isMulti ? [] : undefined);
    }, [ocelId, isMulti, onChange]);

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        {...props}
        value={value ?? (isMulti ? [] : null)}
        data={ids?.response}
        onChange={onChange}
        searchValue={search}
        onSearchChange={setSearch}
        searchable
      />
    );
  };

const QualifierSelect =
  (useQualifier: typeof useE2oQualifier | typeof useO2oQualifier) =>
  ({ ocelId, isMulti, value, onChange, ...props }: OcelSelectProps) => {
    const { data: qualifier } = useQualifier(ocelId);

    useEffect(() => {
      onChange(isMulti ? [] : undefined);
    }, [ocelId, isMulti, onChange]);

    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <SelectComponent
        {...props}
        onChange={onChange}
        value={value ?? (isMulti ? [] : null)}
        data={qualifier}
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
  e2o_qualifier: QualifierSelect(useE2oQualifier),
  o2o_qualifier: QualifierSelect(useO2oQualifier),
};

//TODO: Sync this with backend and use better discriminators
export const OCELField = memo(
  ({
    schema,
    required,
    formData,
    onChange,
    fieldPathId: { path },
  }: FieldProps) => {
    const ocelRef = schema["x-ui-meta"]?.ocel_id;
    const ocelFieldType = schema["x-ui-meta"]?.field_type;
    const theme = schema["x-ui-meta"]?.theme;
    const defaultFrequency = schema["x-ui-meta"]?.default_frequency;

    const { inputResources } = usePluginForm();
    const ocelId = inputResources[ocelRef] ?? null;
    const isMulti = schema.type === "array";

    const Selector = OCEL_FIELDS[ocelFieldType];

    return (
      Selector && (
        <Selector
          key={ocelId}
          ocelId={ocelId}
          isMulti={isMulti}
          theme={theme}
          value={formData}
          defaultFrequency={defaultFrequency}
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
