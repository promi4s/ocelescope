import { Group, Stack, Text } from "@mantine/core";
import {
  createStackedBarChartOption,
  EChartCard,
  type StackedBarDatum,
} from "@ocelescope/charts";
import { useMemo } from "react";

import { useQueryActivityExecutionFrequency } from "../api/querying";
import type { ActivityExecutionFrequencySpec } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";
import type { AnalysisCardProps } from "./types";

interface ActivityExecutionFrequencyContentProps extends AnalysisCardProps {
  spec: ActivityExecutionFrequencySpec;
}

function safeFilename(value: string) {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "activity-execution-frequency"
  );
}

function ActivityExecutionFrequencyContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: ActivityExecutionFrequencyContentProps) {
  const result = useQueryActivityExecutionFrequency(ocelId, spec.query, {
    ocel_version: "filtered",
  });
  const title = spec.title || "Activity execution frequency";
  const option = useMemo(() => {
    if (!result.data) return null;
    const data: StackedBarDatum[] = result.data.rows.map((row) => ({
      category: row.activity,
      series:
        row.label === "1"
          ? "Executed once"
          : row.label === "2"
            ? "Executed twice"
            : `Executed ${row.label} times`,
      value: row.object_count,
    }));
    return createStackedBarChartOption(data, {
      valueName: "Objects",
      categoryAxisName: "Activity",
      valueUnit: { singular: "object", plural: "objects" },
    });
  }, [result.data]);
  const activityCount = new Set(result.data?.rows.map((row) => row.activity))
    .size;

  const info = (
    <Stack gap="xs">
      <Text size="sm">
        Shows how many objects of type “{spec.query.object_type}” executed each
        activity a given number of times across their complete lifecycle.
      </Text>
      <Text size="sm">
        Every object appears exactly once per activity. Execution counts are
        grouped into bounded ranges such as 1, 2, 3–5, and 6–10; high-frequency
        resources therefore do not create unbounded chart layers.
      </Text>
      <Text size="sm">
        Percentages are relative to all objects that executed the activity. The
        active filtered OCEL is used.
      </Text>
    </Stack>
  );

  return (
    <EChartCard
      title={title}
      subtitle={`Object type · ${spec.query.object_type}`}
      info={info}
      filename={safeFilename(title)}
      option={option}
      loading={result.isPending}
      error={result.error ? String(result.error) : undefined}
      empty={result.data?.rows.length === 0}
      emptyMessage="No matching event–object pairs are available in the active OCEL."
      height={300}
      expandedHeight={680}
      zoom={
        activityCount > 8 ? { axis: "x", slider: true, mouse: true } : undefined
      }
      note={
        result.data ? (
          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">
              {result.data.object_count.toLocaleString()} objects ·{" "}
              {result.data.object_activity_pair_count.toLocaleString()}{" "}
              object–activity pairs
            </Text>
            <Text size="xs" c="dimmed">
              Maximum {result.data.maximum_execution_count.toLocaleString()}{" "}
              executions
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

export function ActivityExecutionFrequencyCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "activity-execution-frequency") return null;
  return (
    <ActivityExecutionFrequencyContent {...props} spec={props.card.spec} />
  );
}
