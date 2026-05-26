import { Center, Group, Select, Stack, Text } from "@mantine/core";
import { ValueType, useAggregatedAttributes, useEventCounts } from "@ocelescope/api-base";
import { ChartCard, DistributionChart } from "@ocelescope/charts";
import { useCallback, useState } from "react";

import { useEventAttributeValues } from "../api/base";

export function EventAttributeDistributionPanel({ ocelId }: { ocelId: string }) {
  const { data: eventCounts } = useEventCounts(ocelId);
  const { data: aggregatedAttributes } = useAggregatedAttributes(ocelId);

  const [activity, setActivity] = useState<string | null>(null);
  const [attribute, setAttribute] = useState<string | null>(null);

  const handleActivityChange = useCallback(
    (newActivity: string | null) => {
      setActivity(newActivity);
      setAttribute(null);
    },
    [],
  );

  const activitiesWithNumericAttributes = new Set(
    aggregatedAttributes
      ?.filter((a) => a.type === ValueType.int || a.type === ValueType.float)
      .flatMap((a) => a.actitvities) ?? [],
  );

  const activities = Object.keys(eventCounts ?? {}).map((a) => ({
    value: a,
    label: a,
    disabled: !activitiesWithNumericAttributes.has(a),
  }));

  const numericAttributes = [
    ...new Set(
      aggregatedAttributes
        ?.filter(
          (a) =>
            (a.type === ValueType.int || a.type === ValueType.float) &&
            (activity === null
              ? a.actitvities.length > 0
              : a.actitvities.includes(activity)),
        )
        .map((a) => a.name) ?? [],
    ),
  ];

  const { data: values } = useEventAttributeValues(ocelId, attribute ?? "", {
    activity: activity ?? undefined,
  });

  return (
    <Stack>
      <Group align="flex-end">
        <Select
          label="Activity"
          placeholder="All activities"
          data={activities}
          value={activity}
          onChange={handleActivityChange}
          clearable
          searchable
          style={{ minWidth: 200 }}
        />
        <Select
          label="Attribute"
          placeholder="Select an attribute"
          data={numericAttributes}
          value={attribute}
          onChange={setAttribute}
          clearable
          searchable
          style={{ minWidth: 200 }}
        />
      </Group>

      {attribute && values ? (
        <DistributionChart
          key={`${attribute}-${activity}`}
          title={attribute}
          subtitle={activity ?? "All activities"}
          data={{ values: values.values, missingCount: values.missing_count }}
        />
      ) : (
        <ChartCard title="Distribution">
          <Center h="100%">
            <Text c="dimmed" size="sm">
              Select an attribute to view its distribution.
            </Text>
          </Center>
        </ChartCard>
      )}
    </Stack>
  );
}
