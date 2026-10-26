import { Stack, Text, useMantineTheme } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { OptionPicker, type PickerOption } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  type AttributeValueCount,
  usePreviewAttributeValues,
} from "../../../../../api/base";
import type { DistributionViewProps, PreviewProps } from "../../util";

const ValuePicker: React.FC<DistributionViewProps & PreviewProps> = ({
  data,
  filter,
  onChange,
  ocelId,
  entityType,
  before,
}) => {
  const theme = useMantineTheme();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 300);

  const found = usePreviewAttributeValues(
    ocelId,
    before,
    {
      attribute: filter.attribute,
      search: debounced,
      entity_type: entityType,
      entity_names: filter.target_type ? [filter.target_type] : undefined,
    },
    { query: { enabled: debounced !== "", placeholderData: keepPreviousData } },
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

  const selected = (filter.values ?? []).map(String);
  const exclude = filter.mode === "exclude";
  const picked = usePreviewAttributeValues(
    ocelId,
    before,
    {
      attribute: filter.attribute,
      values: selected,
      entity_type: entityType,
      entity_names: filter.target_type ? [filter.target_type] : undefined,
    },
    {
      query: {
        enabled: selected.length > 0,
        placeholderData: keepPreviousData,
      },
    },
  );
  const matched = picked.data?.count ?? 0;
  const kept =
    selected.length === 0
      ? exclude
        ? 0
        : data.count
      : exclude
        ? data.count - matched
        : matched;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Keeping {kept.toLocaleString()} of {data.count.toLocaleString()} values
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
          onChange({ ...filter, values: next.length ? next : null })
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
          No value picked: every value is {exclude ? "removed" : "kept"}.
        </Text>
      )}
    </Stack>
  );
};

export default ValuePicker;
