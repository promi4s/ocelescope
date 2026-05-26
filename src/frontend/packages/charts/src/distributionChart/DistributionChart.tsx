import {
  Alert,
  NumberInput,
  SegmentedControl,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import type { EChartsOption } from "echarts";
import { TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { EChartCard } from "../EChartCard";
import { bothOption, histogramOption, kdeOption } from "./chartOptions";
import { MODE_OPTIONS } from "./constants";
import { computeHistogram, scottBinCount } from "./histogram";
import { silvermanBandwidth } from "./kde";
import type { DistributionChartProps, DistributionDisplayMode } from "./types";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function DistributionChart({
  data,
  title,
  subtitle,
}: DistributionChartProps) {
  const missingCount = data.missingCount ?? 0;

  const autoBins = useMemo(() => scottBinCount(data.values), [data.values]);

  const [mode, setMode] = useState<DistributionDisplayMode>("histogram");
  const [bins, setBins] = useState(autoBins);
  const [bandwidthMultiplier, setBandwidthMultiplier] = useState(1);

  const histBins = useMemo(
    () => computeHistogram(data.values, bins),
    [data.values, bins],
  );

  const baseBandwidth = useMemo(
    () => silvermanBandwidth(data.values),
    [data.values],
  );

  const bandwidth = baseBandwidth * bandwidthMultiplier;

  const option = useMemo((): EChartsOption => {
    if (data.values.length === 0) return {};

    switch (mode) {
      case "histogram":
        return histogramOption(histBins);
      case "kde":
        return kdeOption(data.values, bandwidth);
      case "both":
        return bothOption(histBins, data.values, bandwidth);
    }
  }, [mode, histBins, data.values, bandwidth]);

  if (data.values.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No values to display.
      </Text>
    );
  }

  const showBins = mode === "histogram" || mode === "both";
  const showBandwidth = mode === "kde" || mode === "both";

  const controls = (
    <SegmentedControl
      value={mode}
      onChange={(value) => setMode(value as DistributionDisplayMode)}
      data={MODE_OPTIONS}
      size="xs"
    />
  );

  const settings = (
    <Stack gap="sm">
      {showBins && (
        <NumberInput
          label="Bins"
          description={`Auto: ${autoBins}`}
          value={bins}
          onChange={(value) => {
            if (typeof value === "number") {
              setBins(Math.max(1, Math.min(100, value)));
            }
          }}
          min={1}
          max={100}
          size="xs"
          style={{ width: 130 }}
        />
      )}

      {showBandwidth && (
        <Stack gap={2} style={{ minWidth: 200 }}>
          <Text size="xs">Bandwidth ×{bandwidthMultiplier.toFixed(2)}</Text>

          <Slider
            value={bandwidthMultiplier}
            onChange={setBandwidthMultiplier}
            min={0.1}
            max={3}
            step={0.05}
            size="xs"
          />
        </Stack>
      )}
    </Stack>
  );

  const note =
    missingCount > 0 ? (
      <Alert color="yellow" icon={<TriangleAlertIcon size={14} />} p="xs">
        <Text size="xs">
          {missingCount.toLocaleString("en-US")} missing value
          {missingCount === 1 ? "" : "s"} excluded.
        </Text>
      </Alert>
    ) : undefined;

  return (
    <EChartCard
      title={title}
      info={subtitle}
      filename={slugify(title) || "distribution"}
      controls={controls}
      settings={settings}
      note={note}
      option={option}
    />
  );
}
