import { Stack, Text, useMantineTheme } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { AttributeValueCount } from "@ocelescope/api-base";
import { useMemo, useState } from "react";
import { OptionPicker, type PickerOption } from "../../Pickers";
import { useAttributeValues } from "../hooks";
import type { ViewProps } from "../types";

const ValuePicker: React.FC<ViewProps> = ({
  summary,
  value: condition,
  onChange,
  inverted,
  objectValue,
  ...scope
}) => {
  const theme = useMantineTheme();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 300);

  const list = useAttributeValues(scope, objectValue, {
    search: debounced || undefined,
  });
  const values: AttributeValueCount[] = list.data?.values ?? [];
  const total = list.data?.distinct_values ?? summary.distinct_values;

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

  const selected =
    condition?.kind === "values" ? condition.values.map(String) : [];

  return (
    <Stack gap="sm">
      <OptionPicker<string>
        variant="list"
        multiple
        counts
        bars
        cutoff
        sort="count"
        options={options}
        loading={list.isFetching}
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
          {inverted ? "every value matches" : "no value matches"}.
        </Text>
      )}
    </Stack>
  );
};

export default ValuePicker;
