import {
  Box,
  Button,
  Group,
  RangeSlider,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";
import type { EChartsOption } from "echarts";
import EChartsReact from "echarts-for-react";
import { type ReactNode, useMemo } from "react";

export type Range = [number, number];

export type Bin = { start: number; end: number; count: number };

type HistogramProps = {
  bins: Bin[];
  value: Range;
  format: (value: number) => string;
  onSelect: (range: Range) => void;
  exclude: boolean;
};

const Histogram: React.FC<HistogramProps> = ({
  bins,
  value: [low, high],
  format,
  onSelect,
  exclude,
}) => {
  const theme = useMantineTheme();

  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const [param] = Array.isArray(params) ? params : [params];
          const bin = bins[param?.dataIndex ?? 0];
          if (!bin) {
            return "";
          }
          const range =
            bin.start === bin.end
              ? format(bin.start)
              : `${format(bin.start)} – ${format(bin.end)}`;
          return `${range}<br/><b>${bin.count.toLocaleString()}</b> values`;
        },
      },
      grid: { left: 8, right: 8, top: 8, bottom: 24, containLabel: true },
      xAxis: {
        type: "category",
        data: bins.map(({ start }) => format(start)),
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "value", splitNumber: 3 },
      series: [
        {
          type: "bar",
          barCategoryGap: "8%",
          data: bins.map(({ start, end, count }) => {
            const isKept = exclude
              ? start < low || end > high
              : end >= low && start <= high;
            return {
              value: count,
              itemStyle: {
                color: theme.colors.blue[6],
                opacity: isKept ? 1 : 0.25,
              },
            };
          }),
        },
      ],
    }),
    [bins, low, high, format, exclude, theme],
  );

  return (
    <EChartsReact
      option={option}
      style={{ height: 260 }}
      onEvents={{
        click: ({ dataIndex }: { dataIndex: number }) => {
          const bin = bins[dataIndex];
          if (bin) {
            onSelect([bin.start, bin.end]);
          }
        },
      }}
    />
  );
};

const STEPS = 1000;

type RangeSelectorProps = {
  min: number;
  max: number;
  value: Range;
  onChange: (range: Range) => void;
  format: (value: number) => string;
  snap?: (value: number) => number;
  exclude: boolean;
};

const RangeSelector: React.FC<RangeSelectorProps> = ({
  min,
  max,
  value: [low, high],
  onChange,
  format,
  snap = (value) => value,
  exclude,
}) => {
  const span = max - min;
  const toPosition = (value: number) =>
    Math.round(((value - min) / span) * STEPS);
  const toValue = (position: number) => {
    if (position <= 0) return min;
    if (position >= STEPS) return max;
    return snap(min + (position / STEPS) * span);
  };

  return (
    <RangeSlider
      px="xs"
      min={0}
      max={STEPS}
      minRange={0}
      inverted={exclude}
      value={[toPosition(low), toPosition(high)]}
      label={(position) => format(toValue(position))}
      onChange={([start, end]) => onChange([toValue(start), toValue(end)])}
    />
  );
};

type RangeViewProps = {
  bins: Bin[];
  min: number;
  max: number;
  value: Range;
  onChange: (range: Range) => void;
  format: (value: number) => string;
  snap?: (value: number) => number;
  exclude?: boolean;
  inputs: ReactNode;
};

const RangeView: React.FC<RangeViewProps> = ({
  bins,
  min,
  max,
  value,
  onChange,
  format,
  snap,
  exclude = false,
  inputs,
}) => {
  const [low, high] = value;

  return (
    <Stack gap="sm">
      <Histogram
        bins={bins}
        value={value}
        format={format}
        onSelect={onChange}
        exclude={exclude}
      />
      {max > min && (
        <RangeSelector
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          format={format}
          snap={snap}
          exclude={exclude}
        />
      )}
      <Group align="end" wrap="nowrap">
        <Box flex={1}>{inputs}</Box>
        <Button
          variant="default"
          onClick={() => onChange([min, max])}
          disabled={low <= min && high >= max}
        >
          Reset
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Click a bar to set the range to it.
      </Text>
    </Stack>
  );
};

export default RangeView;
