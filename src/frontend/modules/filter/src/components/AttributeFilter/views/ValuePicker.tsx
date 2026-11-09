import { Stack, Text, useMantineTheme } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { AttributeValueCount } from "@ocelescope/api-base";
import { OptionPicker, type PickerOption } from "@ocelescope/core";
import { useMemo, useState } from "react";
import { useAttributeValues } from "../hooks";
import type { ViewProps } from "../types";

const ValuePicker: React.FC<ViewProps> = ({
  summary,
  value: filterValue,
  onChange,
  inverted,
  objectValue,
  ...scope
}) => {
  const theme = useMantineTheme();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 300);

  const top = useAttributeValues(scope, objectValue);

  const found = useAttributeValues(
    scope,
    objectValue,
    { search: debounced },
    debounced !== "",
  );

  const isSearching = debounced !== "";
  const values: AttributeValueCount[] = isSearching
    ? (found.data?.values ?? [])
    : (top.data?.values ?? []);
  const total = isSearching
    ? (found.data?.distinct_values ?? 0)
    : summary.distinct_values;

  const options = useMemo<PickerOption<string>[]>(
    () =>
      values.map(({ value, count }) => ({
        value,
        label: value,
        count,
        color: theme.colors.blue[6],
      })),
    [values, theme],
  );

  const current = filterValue;
  const selected = current?.kind === "values" ? current.values.map(String) : [];
  const picked = useAttributeValues(
    scope,
    objectValue,
    { values: selected },
    selected.length > 0,
  );
  const matched = selected.length > 0 ? (picked.data?.count ?? 0) : 0;
  const kept = inverted ? summary.count - matched : matched;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Matching {kept.toLocaleString()} of {summary.count.toLocaleString()}{" "}
        values
      </Text>
      <OptionPicker<string>
        variant="list"
        multiple
        counts
        bars
        cutoff
        sort="count"
        options={options}
        loading={found.isFetching}
        search={search}
        onSearch={setSearch}
        total={total}
        value={selected}
        onChange={(next) => onChange({ kind: "values", values: next })}
      />
      {values.length < total && (
        <Text size="xs" c="dimmed">
          Showing the {values.length} most frequent of {total.toLocaleString()}{" "}
          values. Search to find the others.
        </Text>
      )}
      {selected.length === 0 && (
        <Text size="xs" c="dimmed">
          No value picked:{" "}
          {inverted ? "every value matches" : "nothing matches"}.
        </Text>
      )}
    </Stack>
  );
};

export default ValuePicker;
