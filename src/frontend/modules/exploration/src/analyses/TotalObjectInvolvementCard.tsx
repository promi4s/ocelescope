import { Stack, Text } from "@mantine/core";
import {
  createStackedHistogramChartOption,
  EChartCard,
} from "@ocelescope/charts";
import { useMemo } from "react";
import { useQueryTotalObjectInvolvement } from "../api/exploration";
import type { TotalObjectInvolvementSpec } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";
import type { AnalysisCardProps } from "./types";

function Content(
  props: AnalysisCardProps & { spec: TotalObjectInvolvementSpec },
) {
  const result = useQueryTotalObjectInvolvement(props.ocelId, {
    ocel_version: "filtered",
  });
  const option = useMemo(
    () =>
      result.data
        ? createStackedHistogramChartOption(
            result.data.rows.map((row) => ({
              x: row.object_count,
              series: row.activity,
              value: row.event_count,
            })),
            { xAxisName: "Distinct objects involved", yAxisName: "Events" },
          )
        : null,
    [result.data],
  );
  const title = props.spec.title || "Total objects involved in events";
  return (
    <EChartCard
      title={title}
      subtitle="All object types"
      info={
        <Stack gap="xs">
          <Text size="sm">
            Shows the distribution of the total number of distinct objects
            involved in each event, regardless of object type.
          </Text>
          <Text size="sm">
            The x-axis is the object count, height is the number of events, and
            colour is the activity. Every event is counted once and duplicate
            event–object relations are removed.
          </Text>
          <Text size="sm">
            Events without an object relation appear at zero. The active
            filtered OCEL is used.
          </Text>
        </Stack>
      }
      filename="total-object-involvement"
      option={option}
      loading={result.isPending}
      error={result.error ? String(result.error) : undefined}
      empty={result.data?.rows.length === 0}
      height={300}
      expandedHeight={680}
      zoom={{ axis: "x", slider: true, mouse: true }}
      note={
        result.data ? (
          <Text size="xs" c="dimmed">
            {result.data.event_count.toLocaleString()} unique events
          </Text>
        ) : undefined
      }
      actions={
        <AnalysisCardActions
          onEdit={props.onEdit}
          onDuplicate={props.onDuplicate}
          onRemove={props.onRemove}
        />
      }
    />
  );
}

export function TotalObjectInvolvementCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "total-object-involvement") return null;
  return <Content {...props} spec={props.card.spec} />;
}
