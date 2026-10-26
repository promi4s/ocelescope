import { Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { BarList } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { usePreviewAttributeValues } from "../../../../../api/base";
import type { DistributionViewProps, PreviewProps } from "../../util";

const PatternView: React.FC<DistributionViewProps & PreviewProps> = ({
  data,
  filter,
  onChange,
  ocelId,
  entityType,
  before,
}) => {
  const [pattern] = useDebouncedValue(filter.regex ?? "", 300);
  const exclude = filter.mode === "exclude";

  const matches = usePreviewAttributeValues(
    ocelId,
    before,
    {
      attribute: filter.attribute,
      regex: pattern,
      entity_type: entityType,
      entity_names: filter.target_type ? [filter.target_type] : undefined,
    },
    {
      query: {
        enabled: pattern !== "",
        placeholderData: keepPreviousData,
        retry: false,
      },
    },
  );

  const isEmpty = pattern === "";
  const matched = isEmpty ? data.count : (matches.data?.count ?? 0);
  const values = isEmpty ? (data.values ?? []) : (matches.data?.values ?? []);
  const distinct = isEmpty
    ? data.distinct_values
    : (matches.data?.distinct_values ?? 0);
  const kept = exclude ? data.count - matched : matched;

  return (
    <Stack gap="sm" flex={1} mih={0}>
      <TextInput
        label="Regular expression"
        placeholder="e.g. ^Warehouse"
        value={filter.regex ?? ""}
        error={!isEmpty && matches.error ? "Invalid pattern" : undefined}
        rightSection={matches.isFetching ? <Loader size="xs" /> : undefined}
        onChange={(event) =>
          onChange({ ...filter, regex: event.currentTarget.value })
        }
      />
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {isEmpty
            ? "Most frequent values"
            : `${matched.toLocaleString()} values match (${distinct.toLocaleString()} distinct)`}
        </Text>
        <Text size="sm" c="dimmed">
          Keeping {kept.toLocaleString()} of {data.count.toLocaleString()}{" "}
          values
        </Text>
      </Group>
      {values.length > 0 ? (
        <BarList
          data={Object.fromEntries(
            values.map(({ value, count }) => [value, count]),
          )}
          labelHeader={isEmpty ? "Value" : "Match"}
          maxVisibleItems={values.length}
          style={{ flex: 1, minHeight: 0 }}
        />
      ) : (
        !isEmpty &&
        !matches.isFetching && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No value matches the pattern.
          </Text>
        )
      )}
      {values.length < distinct && (
        <Text size="xs" c="dimmed">
          Showing the {values.length} most frequent of{" "}
          {distinct.toLocaleString()} distinct values.
        </Text>
      )}
    </Stack>
  );
};

export default PatternView;
