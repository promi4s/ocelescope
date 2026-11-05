import { Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useAttributeValues } from "@ocelescope/api-base";
import { BarList } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import {
  type DistributionViewProps,
  type PreviewProps,
  scopeParams,
} from "../../util";

const PatternView: React.FC<DistributionViewProps & PreviewProps> = ({
  data,
  condition,
  onChange,
  ocelId,
  ...scope
}) => {
  const regex =
    condition.condition.kind === "pattern" ? condition.condition.regex : "";
  const [pattern] = useDebouncedValue(regex, 300);
  const negate = condition.negate ?? false;

  const matches = useAttributeValues(
    ocelId,
    { ...scopeParams(scope), regex: pattern },
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
  const kept = negate ? data.count - matched : matched;

  return (
    <Stack gap="sm" flex={1} mih={0}>
      <TextInput
        label="Regular expression"
        placeholder="e.g. ^Warehouse"
        value={regex}
        error={!isEmpty && matches.error ? "Invalid pattern" : undefined}
        rightSection={matches.isFetching ? <Loader size="xs" /> : undefined}
        onChange={(event) =>
          onChange({
            ...condition,
            condition: { kind: "pattern", regex: event.currentTarget.value },
          })
        }
      />
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {isEmpty
            ? "Most frequent values"
            : `${matched.toLocaleString()} values match (${distinct.toLocaleString()} distinct)`}
        </Text>
        <Text size="sm" c="dimmed">
          Matching {kept.toLocaleString()} of {data.count.toLocaleString()}{" "}
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
