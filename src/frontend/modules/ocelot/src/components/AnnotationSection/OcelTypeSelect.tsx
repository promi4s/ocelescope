import { MultiSelect, Select } from "@mantine/core";
import { useMemo } from "react";
import { useEventCounts, useObjectCounts } from "@ocelescope/api-base";

type Props = {
  ocelId: string;
  entityType: "activity" | "object_type";
  value: string | string[];
  onChange: (value: string | string[]) => void;
  isMulti?: boolean;
  label?: string;
  placeholder?: string;
};

const OcelTypeSelect: React.FC<Props> = ({
  ocelId,
  entityType,
  value,
  onChange,
  isMulti = false,
  label,
  placeholder,
}) => {
  const eventCountsQuery = useEventCounts(ocelId);
  const objectCountsQuery = useObjectCounts(ocelId);

  const data = useMemo(() => {
    if (entityType === "activity") {
      return Object.keys(eventCountsQuery.data ?? {});
    }
    return Object.keys(objectCountsQuery.data ?? {});
  }, [entityType, eventCountsQuery.data, objectCountsQuery.data]);

  const loading =
    entityType === "activity"
      ? eventCountsQuery.isLoading
      : objectCountsQuery.isLoading;

  if (isMulti) {
    return (
      <MultiSelect
        searchable
        clearable
        label={label}
        placeholder={placeholder}
        data={data}
        value={Array.isArray(value) ? value : value ? [value] : []}
        onChange={(newValue) => onChange(newValue)}
        disabled={loading}
        nothingFoundMessage="No matching element"
        color="var(--mantine-color-blue-filled)"
      />
    );
  }

  return (
    <Select
      searchable
      clearable
      label={label}
      placeholder={placeholder}
      data={data}
      value={typeof value === "string" ? value : (value[0] ?? null)}
      onChange={(newValue) => onChange(newValue ?? "")}
      disabled={loading}
      nothingFoundMessage="No matching element"
    />
  );
};

export default OcelTypeSelect;
