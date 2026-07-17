import { Group, Stack, Text } from "@mantine/core";
import {
  createSunburstChartOption,
  EChartCard,
  type HierarchyDatum,
} from "@ocelescope/charts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryObjectActivityExecutionDistribution } from "../api/remainingDistributions";
import type { ObjectActivityExecutionDistributionSpec } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";
import type { AnalysisCardProps } from "./types";

function Content(props: AnalysisCardProps & { spec: ObjectActivityExecutionDistributionSpec }) {
  const { ocelId, spec } = props;
  const result = useQuery({
    queryKey: ["object-activity-execution-distribution", ocelId, spec.query],
    queryFn: () => queryObjectActivityExecutionDistribution(
      ocelId, spec.query, { ocel_version: "filtered" },
    ),
  });
  const option = useMemo(() => {
    if (!result.data) return null;
    const grouped = new Map<string, HierarchyDatum[]>();
    for (const row of result.data.rows) {
      const children = grouped.get(row.activity) ?? [];
      children.push({
        label: `${row.execution_count} execution${row.execution_count === 1 ? "" : "s"}`,
        value: row.object_count,
      });
      grouped.set(row.activity, children);
    }
    return createSunburstChartOption(
      Array.from(grouped, ([label, children]) => ({ label, children })),
      { seriesName: "Execution depth", valueName: "Objects" },
    );
  }, [result.data]);
  const title = spec.title || "Object activity execution frequency";
  return (
    <EChartCard
      title={title}
      subtitle={`Object type · ${spec.query.object_type}`}
      info={
        <Stack gap="xs">
          <Text size="sm">Inner ring: activity. Outer ring: exact number of executions across each object's full lifecycle.</Text>
          <Text size="sm">Segment size is the number of objects with that execution count. Activities where every participating object executed exactly once are omitted. Duplicate event–object relations are removed.</Text>
          <Text size="sm">The active filtered OCEL is used.</Text>
        </Stack>
      }
      filename="object-activity-execution-frequency"
      option={option}
      loading={result.isPending}
      error={result.error ? String(result.error) : undefined}
      empty={result.data?.rows.length === 0}
      emptyMessage="No activities with variable execution counts are available."
      height={300}
      expandedHeight={680}
      note={result.data ? (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{result.data.activity_count} activities</Text>
          <Text size="xs" c="dimmed">{result.data.contributing_object_count.toLocaleString()} objects</Text>
        </Group>
      ) : undefined}
      actions={<AnalysisCardActions onEdit={props.onEdit} onDuplicate={props.onDuplicate} onRemove={props.onRemove} />}
    />
  );
}

export function ObjectActivityExecutionDistributionCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "object-activity-execution-distribution") return null;
  return <Content {...props} spec={props.card.spec} />;
}
