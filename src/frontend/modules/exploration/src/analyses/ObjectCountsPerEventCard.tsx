import { Group, Stack, Text } from "@mantine/core";
import {
  createSunburstChartOption,
  EChartCard,
  type HierarchyDatum,
} from "@ocelescope/charts";
import { useMemo } from "react";

import {
  type ActivityEventCount,
  type ObjectCountPerEventRow,
  useQueryObjectCountsPerEvent,
} from "../api/exploration";
import type { ObjectCountsPerEventSpec } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";
import type { AnalysisCardProps } from "./types";

interface ObjectCountsPerEventContentProps extends AnalysisCardProps {
  spec: ObjectCountsPerEventSpec;
}

function hierarchy(
  rows: ObjectCountPerEventRow[],
  activityEventCounts: ActivityEventCount[],
): HierarchyDatum[] {
  const uniqueEvents = new Map(
    activityEventCounts.map((item) => [item.activity, item.event_count]),
  );
  const activities = new Map<
    string,
    Map<string, Array<{ count: number; frequency: number }>>
  >();
  for (const row of rows) {
    const objectTypes =
      activities.get(row.activity) ??
      new Map<string, Array<{ count: number; frequency: number }>>();
    const counts = objectTypes.get(row.object_type) ?? [];
    counts.push({ count: row.object_count, frequency: row.event_count });
    objectTypes.set(row.object_type, counts);
    activities.set(row.activity, objectTypes);
  }

  return Array.from(activities, ([activity, objectTypes]) => ({
    label: activity,
    tooltipValue: uniqueEvents.get(activity) ?? 0,
    tooltipValueName: "Unique events",
    children: Array.from(objectTypes, ([objectType, counts]) => {
      const eventCount = counts.reduce((sum, item) => sum + item.frequency, 0);
      const activityEventCount = uniqueEvents.get(activity) ?? 0;
      return {
        label: objectType,
        tooltipPercentage:
          activityEventCount > 0 ? (eventCount / activityEventCount) * 100 : 0,
        children: counts.map(({ count, frequency }) => ({
          label: `${count} object${count === 1 ? "" : "s"}`,
          value: frequency,
        })),
      };
    }),
  }));
}

function safeFilename(value: string) {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "objects-involved-per-event"
  );
}

function ObjectCountsPerEventContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: ObjectCountsPerEventContentProps) {
  const result = useQueryObjectCountsPerEvent(ocelId, spec.query, {
    ocel_version: "filtered",
  });
  const title = spec.title || "Objects involved per event";
  const option = useMemo(
    () =>
      result.data
        ? createSunburstChartOption(
            hierarchy(result.data.rows, result.data.activity_event_counts),
            {
              seriesName: "Event–object-type cases",
              valueName: "Events",
            },
          )
        : null,
    [result.data],
  );
  const uniqueEventCount =
    result.data?.activity_event_counts.reduce(
      (sum, item) => sum + item.event_count,
      0,
    ) ?? 0;
  const activityLabel = spec.query.activities?.length
    ? `${spec.query.activities.length} selected activities`
    : "All activities";

  const info = (
    <Stack gap="xs">
      <Text size="sm">
        Shows how many distinct objects of each type participate in an event.
        The hierarchy is activity → object type → number of objects.
      </Text>
      <Text size="sm">
        Duplicate event–object relations are counted once. Segment size is the
        number of events having exactly that object count for the activity and
        object type. Because object-type populations overlap, the activity ring
        is structural; its hover value reports unique events instead of summing
        its object-type children. Object-type percentages use the activity's
        unique events as their denominator; count percentages use the
        corresponding object type.
      </Text>
      <Text size="sm">The active filtered OCEL is used.</Text>
    </Stack>
  );

  return (
    <EChartCard
      title={title}
      subtitle={activityLabel}
      info={info}
      filename={safeFilename(title)}
      option={option}
      loading={result.isPending}
      error={result.error ? String(result.error) : undefined}
      empty={result.data?.rows.length === 0}
      emptyMessage="No matching event–object relations are available in the active OCEL."
      height={300}
      expandedHeight={680}
      note={
        result.data ? (
          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">
              {uniqueEventCount.toLocaleString()} unique events
            </Text>
            <Text size="xs" c="dimmed">
              Click a segment to focus
            </Text>
          </Group>
        ) : undefined
      }
      actions={
        <AnalysisCardActions
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      }
    />
  );
}

export function ObjectCountsPerEventCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "object-counts-per-event") return null;
  return <ObjectCountsPerEventContent {...props} spec={props.card.spec} />;
}
