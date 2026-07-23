import { Stack, Text } from "@mantine/core";
import {
  createObjectAttributeTimelineChartOption,
  EChartCard,
} from "@ocelescope/charts";
import { useMemo } from "react";
import { useQueryObjectAttributeTimeline } from "../api/exploration";
import type { ObjectAttributeTimelineSpec } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";
import type { AnalysisCardProps } from "./types";

function Content(
  props: AnalysisCardProps & { spec: ObjectAttributeTimelineSpec },
) {
  const result = useQueryObjectAttributeTimeline(
    props.ocelId,
    props.spec.query,
    {
      ocel_version: "filtered",
    },
  );
  const attributeCount = result.data
    ? Object.keys(result.data.series).length
    : 0;
  const option = useMemo(
    () =>
      result.data
        ? createObjectAttributeTimelineChartOption(
            result.data.points.map((point) => ({
              label: point.activity ?? "",
              activity: point.activity ?? undefined,
            })),
            result.data.series,
          )
        : null,
    [result.data],
  );
  const title = props.spec.title || "Object attribute value development";

  return (
    <EChartCard
      title={title}
      subtitle={`Object · ${props.spec.query.object_id}`}
      info={
        <Stack gap="xs">
          <Text size="sm">
            Shows how every attribute of the selected object's type changed over
            the object's lifetime, overlaid on one shared timeline of the
            object's own events (labelled by activity) and any timestamps where
            an attribute changed.
          </Text>
          <Text size="sm">
            Each attribute keeps its own y-axis (own scale/unit) and color;
            toggle a line via the legend to focus on it. Values are held
            constant between changes (a step line), matching the object's actual
            state at each point. The active filtered OCEL is used.
          </Text>
        </Stack>
      }
      filename="object-attribute-timeline"
      option={option}
      loading={result.isPending}
      error={result.error ? String(result.error) : undefined}
      empty={result.data?.points.length === 0}
      emptyMessage="This object's type has no attributes to plot."
      expandedHeight={620}
      note={
        result.data ? (
          <Text size="xs" c="dimmed">
            {result.data.object_type} · {attributeCount} attribute
            {attributeCount === 1 ? "" : "s"} · {result.data.points.length}{" "}
            points
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

export function ObjectAttributeTimelineCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "object-attribute-timeline") return null;
  return <Content {...props} spec={props.card.spec} />;
}
