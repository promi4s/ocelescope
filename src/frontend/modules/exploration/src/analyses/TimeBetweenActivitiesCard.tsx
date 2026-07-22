import { Group, Stack, Text } from "@mantine/core";

import { useQueryTimeBetweenActivities } from "../api/exploration";
import type { TimeBetweenActivitiesSpec } from "../model/dashboard";
import { DistributionChartCard } from "./DistributionChartCard";
import type { AnalysisCardProps } from "./types";

interface TimeBetweenActivitiesContentProps extends AnalysisCardProps {
  spec: TimeBetweenActivitiesSpec;
}

function TimeBetweenActivitiesContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: TimeBetweenActivitiesContentProps) {
  const result = useQueryTimeBetweenActivities(ocelId, spec.query, {
    ocel_version: "filtered",
  });
  const title = spec.title || "Time between activities";

  const info = (
    <Stack gap="xs">
      <Text size="sm">
        Shows elapsed time from “{spec.query.source_activity}” to “
        {spec.query.target_activity}” in object traces of type “
        {spec.query.object_type}”.
      </Text>
      <Text size="sm">
        Each object trace is first filtered to the two selected activities. A
        duration is measured whenever a target directly follows a source in that
        filtered trace, so unrelated activities may occur between them in the
        original trace.
      </Text>
      <Text size="sm">
        One object can contribute multiple pairs. Duplicate event–object
        relations are removed. The active filtered OCEL is used.
      </Text>
    </Stack>
  );

  return (
    <DistributionChartCard
      visualization="histogram"
      data={result.data}
      loading={result.isPending}
      error={result.error}
      title={title}
      subtitle={`${spec.query.source_activity} → ${spec.query.target_activity} · ${spec.query.object_type} · ${spec.query.unit}`}
      info={info}
      filenameFallback="time-between-activities"
      seriesName="Activity pairs"
      populationLabel="matched pairs"
      emptyMessage="No consecutive source-to-target pairs are available in the active OCEL."
      note={
        result.data ? (
          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">
              {result.data.pair_count.toLocaleString()} matched pairs
            </Text>
            <Text size="xs" c="dimmed">
              {result.data.contributing_object_count.toLocaleString()}{" "}
              contributing objects
            </Text>
          </Group>
        ) : undefined
      }
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
    />
  );
}

export function TimeBetweenActivitiesCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "time-between-activities") return null;
  return <TimeBetweenActivitiesContent {...props} spec={props.card.spec} />;
}
