import { Group, Text } from "@mantine/core";
import {
  createBarChartOption,
  createDonutChartOption,
  createHistogramChartOption,
  EChartCard,
  type FrequencyDatum,
} from "@ocelescope/charts";
import { type ReactNode, useMemo } from "react";
import type {
  DistributionBucket,
  DistributionResponse,
} from "../api/exploration";
import type { DistributionVisualization } from "../model/dashboard";
import { AnalysisCardActions } from "./AnalysisCardActions";

const CHART_HEIGHT = 300;

interface DistributionChartCardProps {
  visualization: DistributionVisualization;
  data?: DistributionResponse;
  loading: boolean;
  error?: unknown;
  title: string;
  subtitle: string;
  info: ReactNode;
  filenameFallback: string;
  seriesName: string;
  populationLabel: string;
  emptyMessage: string;
  note?: ReactNode;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function toFrequencyDatum(bucket: DistributionBucket): FrequencyDatum {
  return {
    label: bucket.label,
    value: bucket.count,
    kind:
      bucket.kind === "missing" || bucket.kind === "other"
        ? bucket.kind
        : "value",
  };
}

function chartOption(
  visualization: DistributionVisualization,
  buckets: DistributionBucket[],
  seriesName: string,
) {
  if (visualization === "histogram") {
    const missing = buckets.find((bucket) => bucket.kind === "missing");
    return createHistogramChartOption(
      {
        bins: buckets
          .filter((bucket) => bucket.kind === "range")
          .map(toFrequencyDatum),
        ...(missing ? { missing: toFrequencyDatum(missing) } : {}),
      },
      { seriesName },
    );
  }

  if (visualization === "donut") {
    return createDonutChartOption(buckets.map(toFrequencyDatum), {
      seriesName,
    });
  }

  return createBarChartOption(buckets.map(toFrequencyDatum), { seriesName });
}

function safeFilename(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function DistributionChartCard({
  visualization,
  data,
  loading,
  error,
  title,
  subtitle,
  info,
  filenameFallback,
  seriesName,
  populationLabel,
  emptyMessage,
  note,
  onEdit,
  onDuplicate,
  onRemove,
}: DistributionChartCardProps) {
  const option = useMemo(
    () => (data ? chartOption(visualization, data.buckets, seriesName) : null),
    [data, seriesName, visualization],
  );

  const defaultNote = data ? (
    <Group justify="space-between" gap="xs">
      <Text size="xs" c="dimmed">
        {data.counts.total.toLocaleString()} {populationLabel}
      </Text>
      <Text size="xs" c="dimmed">
        {data.counts.missing.toLocaleString()} missing
      </Text>
    </Group>
  ) : undefined;

  return (
    <EChartCard
      title={title}
      subtitle={subtitle}
      info={info}
      filename={safeFilename(title) || filenameFallback}
      actions={
        <AnalysisCardActions
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      }
      note={note ?? defaultNote}
      height={CHART_HEIGHT}
      expandedHeight={680}
      option={option}
      zoom={
        visualization === "donut"
          ? undefined
          : { axis: "x", slider: true, mouse: true }
      }
      loading={loading}
      error={error ? String(error) : undefined}
      empty={data?.counts.total === 0}
      emptyMessage={emptyMessage}
    />
  );
}
