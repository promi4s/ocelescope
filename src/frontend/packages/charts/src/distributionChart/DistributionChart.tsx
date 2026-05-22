import {
  Alert,
  Group,
  NumberInput,
  SegmentedControl,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import { TriangleAlertIcon } from "lucide-react";
import type { EChartsOption } from "echarts";
import { useMemo, useState } from "react";
import { EChart } from "../EChart";

export interface DistributionData {
  /** Raw numeric values, NaN/missing already excluded. */
  values: number[];
  /** Number of NaN / missing values in the original column. */
  missingCount: number;
  /** Total count including missing (values.length + missingCount). */
  totalCount: number;
  /** Optional axis label suffix, e.g. "seconds" or "EUR". */
  unit?: string;
}

export type DistributionDisplayMode = "histogram" | "kde" | "both";

export interface DistributionChartProps {
  data: DistributionData;
  /** Initial display mode. Default: "histogram". */
  initialMode?: DistributionDisplayMode;
  /** Initial bin count. Default: Scott's rule. */
  initialBins?: number;
  /** Initial bandwidth multiplier applied to Silverman bandwidth. Default: 1.0. */
  initialBandwidthMultiplier?: number;
  info?: string;
  height?: number | string;
  filename?: string;
  title?: string;
}

interface HistBin {
  lower: number;
  upper: number;
  center: number;
  count: number;
  density: number;
  label: string;
}

function safeMin(values: number[]): number {
  return values.reduce((m, v) => (v < m ? v : m), Infinity);
}
function safeMax(values: number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), -Infinity);
}
function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}
function stddev(values: number[]): number {
  const mu = mean(values);
  return Math.sqrt(
    values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length,
  );
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return n.toExponential(2);
  if (Number.isInteger(n)) return String(n);
  return n.toPrecision(4).replace(/\.?0+$/, "");
}

function scottBinCount(values: number[]): number {
  if (values.length < 2) return 1;
  const sd = stddev(values);
  const lo = safeMin(values);
  const hi = safeMax(values);
  if (sd === 0 || lo === hi) return 1;
  const w = 3.5 * sd * Math.pow(values.length, -1 / 3);
  return Math.max(2, Math.min(100, Math.ceil((hi - lo) / w)));
}

function silvermanBandwidth(values: number[]): number {
  if (values.length < 2) return 1;
  const sd = stddev(values);
  if (sd === 0) return 1;
  return 1.06 * sd * Math.pow(values.length, -0.2);
}

function computeHistogram(values: number[], binCount: number): HistBin[] {
  const lo = safeMin(values);
  const hi = safeMax(values);
  const n = values.length;
  if (lo === hi || binCount < 1) {
    return [
      {
        lower: lo - 0.5,
        upper: hi + 0.5,
        center: lo,
        count: n,
        density: n,
        label: fmtNum(lo),
      },
    ];
  }
  const w = (hi - lo) / binCount;
  const bins: HistBin[] = Array.from({ length: binCount }, (_, i) => {
    const lower = lo + i * w;
    const upper = lower + w;
    return {
      lower,
      upper,
      center: (lower + upper) / 2,
      count: 0,
      density: 0,
      label: `${fmtNum(lower)}`,
    };
  });
  for (const v of values) {
    let idx = Math.floor((v - lo) / w);
    if (idx >= binCount) idx = binCount - 1;
    if (idx >= 0) bins[idx]!.count++;
  }
  for (const bin of bins) {
    bin.density = bin.count / (n * w);
  }
  return bins;
}

function gaussianKDE(
  values: number[],
  bandwidth: number,
  evalPoints: number[],
): number[] {
  const n = values.length;
  const k = 1 / Math.sqrt(2 * Math.PI);
  return evalPoints.map((x) => {
    let sum = 0;
    for (const xi of values) {
      const u = (x - xi) / bandwidth;
      sum += k * Math.exp(-0.5 * u * u);
    }
    return sum / (n * bandwidth);
  });
}

function histogramOption(bins: HistBin[], unit?: string): EChartsOption {
  const rotate = bins.length > 10 ? 35 : 0;
  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: rotate ? 64 : 36,
      top: 12,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as Array<{ dataIndex: number }>;
        const idx = arr[0]?.dataIndex ?? 0;
        const bin = bins[idx];
        if (!bin) return "";
        const pct = (
          (bin.count / bins.reduce((s, b) => s + b.count, 0)) *
          100
        ).toFixed(1);
        const range = `[${fmtNum(bin.lower)}, ${fmtNum(bin.upper)})`;
        return (
          `<strong>${range}${unit ? ` ${unit}` : ""}</strong><br/>` +
          `Count: <b>${bin.count.toLocaleString("en-US")}</b><br/>` +
          `Relative: <b>${pct}%</b>`
        );
      },
    },
    xAxis: {
      type: "category",
      data: bins.map((b) => b.label),
      name: unit,
      axisLabel: { rotate, overflow: "truncate", width: 100 },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 44,
    },
    series: [
      {
        type: "bar",
        data: bins.map((b) => b.count),
        barCategoryGap: "0%",
      },
    ],
  };
}

function kdeOption(
  values: number[],
  bandwidth: number,
  unit?: string,
): EChartsOption {
  const lo = safeMin(values);
  const hi = safeMax(values);
  const evalPoints = Array.from(
    { length: 256 },
    (_, i) => lo + ((hi - lo) * i) / 255,
  );
  const densities = gaussianKDE(values, bandwidth, evalPoints);
  const data = evalPoints.map(
    (x, i) => [x, densities[i] ?? 0] as [number, number],
  );

  return {
    grid: { containLabel: true, left: 16, right: 16, bottom: 36, top: 12 },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const arr = params as Array<{ data: [number, number] }>;
        const pt = arr[0]?.data;
        if (!pt) return "";
        return (
          `x: <b>${fmtNum(pt[0])}${unit ? ` ${unit}` : ""}</b><br/>` +
          `Density: <b>${pt[1].toExponential(3)}</b>`
        );
      },
    },
    xAxis: {
      type: "value",
      name: unit,
      min: lo,
      max: hi,
    },
    yAxis: {
      type: "value",
      name: "Density",
      nameLocation: "middle",
      nameGap: 56,
    },
    series: [
      {
        type: "line",
        data,
        smooth: false,
        symbol: "none",
        areaStyle: { opacity: 0.2 },
      },
    ],
  };
}

function bothOption(
  bins: HistBin[],
  values: number[],
  bandwidth: number,
  unit?: string,
): EChartsOption {
  const n = values.length;
  const rotate = bins.length > 10 ? 35 : 0;

  const lo = safeMin(values);
  const hi = safeMax(values);
  const evalPoints = Array.from(
    { length: 256 },
    (_, i) => lo + ((hi - lo) * i) / 255,
  );
  const kdeDensities = gaussianKDE(values, bandwidth, evalPoints);
  const kdeData = evalPoints.map(
    (x, i) => [x, kdeDensities[i] ?? 0] as [number, number],
  );

  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: rotate ? 64 : 36,
      top: 28,
    },
    legend: { show: true, top: 0, data: ["Histogram", "KDE"] },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as Array<{
          dataIndex: number;
          seriesName: string;
          value: number | [number, number];
          axisIndex: number;
        }>;
        const histEntry = arr.find((p) => p.seriesName === "Histogram");
        if (!histEntry) return "";
        const idx = histEntry.dataIndex;
        const bin = bins[idx];
        if (!bin) return "";
        const range = `[${fmtNum(bin.lower)}, ${fmtNum(bin.upper)})`;
        const pct = n > 0 ? ((bin.count / n) * 100).toFixed(1) : "0.0";
        return (
          `<strong>${range}${unit ? ` ${unit}` : ""}</strong><br/>` +
          `Count: <b>${bin.count.toLocaleString("en-US")}</b> (${pct}%)<br/>` +
          `Density: <b>${bin.density.toExponential(3)}</b>`
        );
      },
    },
    xAxis: [
      {
        type: "category",
        data: bins.map((b) => b.label),
        name: unit,
        axisLabel: { rotate, overflow: "truncate", width: 100 },
      },
      {
        type: "value",
        min: lo,
        max: hi,
        show: false,
      },
    ],
    yAxis: {
      type: "value",
      name: "Density",
      nameLocation: "middle",
      nameGap: 56,
    },
    series: [
      {
        name: "Histogram",
        type: "bar",
        xAxisIndex: 0,
        data: bins.map((b) => b.density),
        barCategoryGap: "0%",
        itemStyle: { opacity: 0.55 },
      },
      {
        name: "KDE",
        type: "line",
        xAxisIndex: 1,
        data: kdeData,
        smooth: false,
        symbol: "none",
      },
    ],
  };
}

const MODE_OPTIONS = [
  { value: "histogram", label: "Histogram" },
  { value: "kde", label: "KDE" },
  { value: "both", label: "Both" },
];

export const DistributionChart: React.FC<DistributionChartProps> = ({
  data,
  initialMode = "histogram",
  initialBins,
  initialBandwidthMultiplier = 1.0,
  info,
  height = 340,
  filename = "distribution",
  title,
}) => {
  const autoBins = useMemo(() => scottBinCount(data.values), [data.values]);
  const [mode, setMode] = useState<DistributionDisplayMode>(initialMode);
  const [bins, setBins] = useState<number>(initialBins ?? autoBins);
  const [bwMult, setBwMult] = useState<number>(initialBandwidthMultiplier);

  const histBins = useMemo(
    () => computeHistogram(data.values, bins),
    [data.values, bins],
  );

  const bandwidth = useMemo(() => {
    const auto = silvermanBandwidth(data.values);
    return auto * bwMult;
  }, [data.values, bwMult]);

  const option = useMemo((): EChartsOption => {
    if (data.values.length === 0) return {};
    if (mode === "histogram") return histogramOption(histBins, data.unit);
    if (mode === "kde") return kdeOption(data.values, bandwidth, data.unit);
    return bothOption(histBins, data.values, bandwidth, data.unit);
  }, [mode, histBins, bandwidth, data.values, data.unit]);

  const showBins = mode === "histogram" || mode === "both";
  const showBw = mode === "kde" || mode === "both";

  const autoInfo =
    `Distribution of ${data.totalCount.toLocaleString("en-US")} values` +
    (data.missingCount > 0
      ? ` (${data.missingCount.toLocaleString("en-US")} missing/NaN excluded)`
      : "") +
    `. Histogram: equal-width bins. KDE: Gaussian kernel, bandwidth via Silverman's rule (h = 1.06·σ·n⁻¹⁄⁵) scaled by the multiplier. In "Both" mode the histogram is normalized to density so both series share the same y-axis.`;

  if (data.values.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No values to display.
      </Text>
    );
  }

  const controls = (
    <Group gap="md" align="flex-end" wrap="wrap">
      <SegmentedControl
        value={mode}
        onChange={(v) => {
          setMode(v as DistributionDisplayMode);
        }}
        data={MODE_OPTIONS}
        size="xs"
      />
      {showBins && (
        <NumberInput
          label={`Bins (auto: ${String(autoBins)})`}
          value={bins}
          onChange={(v) => {
            setBins(
              typeof v === "number" ? Math.max(1, Math.min(100, v)) : autoBins,
            );
          }}
          min={1}
          max={100}
          size="xs"
          style={{ width: 130 }}
        />
      )}
      {showBw && (
        <Stack gap={2} style={{ minWidth: 200, flex: 1 }}>
          <Text size="xs">
            Bandwidth ×{bwMult.toFixed(2)}
            <Text span c="dimmed" size="xs">
              {" "}
              (h = {(silvermanBandwidth(data.values) * bwMult).toExponential(3)}
              )
            </Text>
          </Text>
          <Slider
            value={bwMult}
            onChange={setBwMult}
            min={0.1}
            max={3.0}
            step={0.05}
            size="xs"
          />
        </Stack>
      )}
    </Group>
  );

  const note =
    data.missingCount > 0 ? (
      <Alert color="yellow" icon={<TriangleAlertIcon size={14} />} p="xs">
        <Text size="xs">
          {data.missingCount.toLocaleString("en-US")} missing/NaN value
          {data.missingCount !== 1 ? "s" : ""} excluded from this plot.
        </Text>
      </Alert>
    ) : undefined;

  return (
    <EChart
      option={option}
      info={info ?? autoInfo}
      filename={filename}
      height={height}
      title={title}
      controls={controls}
      note={note}
    />
  );
};
