import { Group, Stack, Text } from "@mantine/core";
import {
  createHorizontalStackedBarChartOption,
  EChartCard,
  type StackedBarDatum,
} from "@ocelescope/charts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryObjectTypeCombinations } from "../api/querying";
import type { ObjectTypeCombinationsSpec } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";
import type { AnalysisCardProps } from "./types";

interface ObjectTypeCombinationsContentProps extends AnalysisCardProps {
  spec: ObjectTypeCombinationsSpec;
}

function combinationLabel(objectTypes: string[]) {
  return objectTypes.length > 0 ? objectTypes.join(" + ") : "No object types";
}

function chartData(
  rows: Array<{
    object_types: string[];
    activity: string;
    event_count: number;
  }>,
): StackedBarDatum[] {
  return rows.map((row) => {
    const label = combinationLabel(row.object_types);
    return {
      category: label,
      fullCategory: label,
      series: row.activity,
      value: row.event_count,
    };
  });
}

function safeFilename(value: string) {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "object-type-combinations"
  );
}

function ObjectTypeCombinationsContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: ObjectTypeCombinationsContentProps) {
  const result = useQuery({
    queryKey: [
      `/api/external/modules/querying/v1/ocels/${ocelId}/queries/object-type-combinations`,
      spec.query,
    ],
    queryFn: () =>
      queryObjectTypeCombinations(ocelId, spec.query, {
        ocel_version: "filtered",
      }),
  });
  const title = spec.title || "Object-type combinations per event";
  const selectedActivities = spec.query.activities ?? [];
  const singleActivity = selectedActivities.length === 1;
  const option = useMemo(
    () =>
      result.data
        ? createHorizontalStackedBarChartOption(chartData(result.data.rows), {
            valueName: "Events",
            categoryAxisName: "Object types",
            percentageTotal: singleActivity
              ? result.data.total_event_count
              : undefined,
            interactiveLegend: false,
          })
        : null,
    [result.data, singleActivity],
  );
  const displayedCombinations = new Set(
    result.data?.rows.map((row) => combinationLabel(row.object_types)),
  ).size;

  const info = (
    <Stack gap="xs">
      <Text size="sm">
        Each bar represents the exact set of object types present in an event.
        Events are counted once and split by activity.
      </Text>
      <Text size="sm">
        Repeated objects of the same type do not change the combination.
        {singleActivity
          ? " Percentages use all events of the selected activity as their denominator."
          : " Percentages show each activity's share of all events with that exact combination."}
      </Text>
      <Text size="sm">
        Only the most frequent combinations are shown. The active filtered OCEL
        is used.
      </Text>
    </Stack>
  );

  return (
    <EChartCard
      title={title}
      subtitle={`${singleActivity ? selectedActivities[0] : selectedActivities.length > 1 ? `${selectedActivities.length} activities` : "All activities"} · Top ${spec.query.limit ?? 15} combinations`}
      info={info}
      filename={safeFilename(title)}
      option={option}
      loading={result.isPending}
      error={result.error ? String(result.error) : undefined}
      empty={result.data?.rows.length === 0}
      emptyMessage="No events are available in the active OCEL."
      height={300}
      expandedHeight={680}
      zoom={
        displayedCombinations > 8
          ? { axis: "y", slider: true, mouse: true }
          : undefined
      }
      note={
        result.data ? (
          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">
              {result.data.total_event_count.toLocaleString()} events shown
            </Text>
            <Text size="xs" c="dimmed">
              {displayedCombinations} of{" "}
              {result.data.total_combination_count.toLocaleString()}{" "}
              combinations
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

export function ObjectTypeCombinationsCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "object-type-combinations") return null;
  return <ObjectTypeCombinationsContent {...props} spec={props.card.spec} />;
}
