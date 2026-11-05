import { Stack, Text, useMantineTheme } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  type AttributeValueCount,
  useAttributeValues,
} from "@ocelescope/api-base";
import { OptionPicker, type PickerOption } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  type DistributionViewProps,
  type PreviewProps,
  scopeParams,
} from "../../util";

const ValuePicker: React.FC<DistributionViewProps & PreviewProps> = ({
  data,
  condition,
  onChange,
  ocelId,
  ...scope
}) => {
  const theme = useMantineTheme();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 300);

  const found = useAttributeValues(
    ocelId,
    { ...scopeParams(scope), search: debounced },
    {
      query: {
        enabled: debounced !== "",
        placeholderData: keepPreviousData,
      },
    },
  );

  const isSearching = debounced !== "";
  const values: AttributeValueCount[] = isSearching
    ? (found.data?.values ?? [])
    : (data.values ?? []);
  const total = isSearching
    ? (found.data?.distinct_values ?? 0)
    : data.distinct_values;

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
    condition.condition.kind === "values"
      ? condition.condition.values.map(String)
      : [];
  const negate = condition.negate ?? false;
  const picked = useAttributeValues(
    ocelId,
    { ...scopeParams(scope), values: selected },
    {
      query: {
        enabled: selected.length > 0,
        placeholderData: keepPreviousData,
      },
    },
  );
  const matched = selected.length > 0 ? (picked.data?.count ?? 0) : 0;
  const kept = negate ? data.count - matched : matched;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Matching {kept.toLocaleString()} of {data.count.toLocaleString()} values
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
        onChange={(next) =>
          onChange({
            ...condition,
            condition: { kind: "values", values: next },
          })
        }
      />
      {values.length < total && (
        <Text size="xs" c="dimmed">
          Showing the {values.length} most frequent of {total.toLocaleString()}{" "}
          values. Search to find the others.
        </Text>
      )}
      {selected.length === 0 && (
        <Text size="xs" c="dimmed">
          No value picked: {negate ? "every value matches" : "nothing matches"}.
        </Text>
      )}
    </Stack>
  );
};

export default ValuePicker;
