import { Group, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { BarList } from "../../BarList/BarList";
import { useAttributeValues } from "../hooks";
import type { ViewProps } from "../types";
import { matching } from "../util";

const PatternView: React.FC<ViewProps> = ({
  summary,
  value: filterValue,
  onChange,
  inverted,
  includeNull,
  objectValue,
  ...scope
}) => {
  const current = filterValue;
  const regex = current?.kind === "pattern" ? current.regex : "";
  const [pattern] = useDebouncedValue(regex, 300);

  const matches = useAttributeValues(scope, objectValue, {
    regex: pattern || undefined,
  });

  const isEmpty = pattern === "";
  const matched = matches.data?.count ?? summary.count;
  const values = matches.data?.values ?? [];
  const distinct = matches.data?.distinct_values ?? summary.distinct_values;
  const { kept, total } = matching(summary, matched, inverted, includeNull);

  return (
    <Stack gap="sm" flex={1} mih={0}>
      <TextInput
        label="Regular expression"
        placeholder="e.g. ^Warehouse"
        value={regex}
        error={!isEmpty && matches.error ? "Invalid pattern" : undefined}
        rightSection={matches.isFetching ? <Loader size="xs" /> : undefined}
        onChange={(event) =>
          onChange({ kind: "pattern", regex: event.currentTarget.value })
        }
      />
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {isEmpty
            ? "Most frequent values"
            : `${matched.toLocaleString()} values match (${distinct.toLocaleString()} distinct)`}
        </Text>
        <Text size="sm" c="dimmed">
          Matching {kept.toLocaleString()} of {total.toLocaleString()}{" "}
          {scope.entityType}
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
