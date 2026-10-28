import {
  Box,
  Grid,
  Group,
  LoadingOverlay,
  RangeSlider,
  SegmentedControl,
  useMantineTheme,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { type EntityTimeInfo, useTimeInfo } from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChartsReact from "echarts-for-react";
import { memo, useMemo } from "react";
import type { TimeFrameFilterMode } from "../../api/base";
import { useView } from "../../hooks/useView";
import type { FilterKind, FilterPanel } from "../../types/filter";
import dayjs from "../../util/dayjs";

const DATE_FORMAT = "YYYY-MM-DD HH:mm";

const MODE_OPTIONS = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" },
];

const TimeGraph: React.FC<{
  timeInfo: EntityTimeInfo;
  startDate?: string;
  endDate?: string;
  mode: TimeFrameFilterMode;
}> = memo(({ timeInfo, startDate, endDate, mode }) => {
  const theme = useMantineTheme();

  const option: EChartsOption = useMemo(() => {
    const buckets = timeInfo.date_distribution.map(
      ({ start_timestamp, end_timestamp, entity_count }) => {
        const overlapsRange =
          (!startDate || dayjs(end_timestamp).isAfter(dayjs(startDate))) &&
          (!endDate || dayjs(start_timestamp).isBefore(dayjs(endDate)));
        const insideRange =
          (!startDate || !dayjs(start_timestamp).isBefore(dayjs(startDate))) &&
          (!endDate || !dayjs(end_timestamp).isAfter(dayjs(endDate)));

        return {
          label: `${dayjs(start_timestamp).format(DATE_FORMAT)} - ${dayjs(end_timestamp).format(DATE_FORMAT)}`,
          count: Object.values(entity_count).reduce(
            (acc, curr) => acc + curr,
            0,
          ),
          isKept: mode === "exclude" ? !insideRange : overlapsRange,
        };
      },
    );

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 0, right: 0, top: 8, bottom: 0 },
      xAxis: {
        type: "category",
        data: buckets.map(({ label }) => label),
        show: false,
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          type: "bar",
          name: "count",
          barCategoryGap: 0,
          data: buckets.map(({ count, isKept }) => ({
            value: count,
            itemStyle: {
              color: theme.colors.blue[6],
              opacity: isKept ? 1 : 0.25,
            },
          })),
        },
      ],
    };
  }, [timeInfo, startDate, endDate, mode, theme]);

  return <EChartsReact option={option} style={{ height: 300 }} />;
});

const TimeFrameSlider: React.FC<{
  timeInfo: EntityTimeInfo;
  startTime: string;
  endTime: string;
  mode: TimeFrameFilterMode;
  onChange: (newTimeFrame: [string, string]) => void;
}> = ({ timeInfo, startTime, endTime, mode, onChange }) => {
  const distribution = timeInfo.date_distribution;
  const lastIndex = distribution.length - 1;

  const startIndex = useMemo(() => {
    const index = distribution.findIndex(({ end_timestamp }) =>
      dayjs(startTime).isBefore(end_timestamp),
    );

    return index === -1 ? Math.max(lastIndex, 0) : index;
  }, [startTime, distribution, lastIndex]);

  const endIndex = useMemo(() => {
    const index = distribution.findLastIndex(({ start_timestamp }) =>
      dayjs(endTime).isAfter(start_timestamp),
    );

    return index === -1 ? 0 : index;
  }, [endTime, distribution]);

  if (lastIndex < 0) {
    return null;
  }

  return (
    <RangeSlider
      min={0}
      max={lastIndex}
      minRange={0}
      inverted={mode === "exclude"}
      value={[startIndex, endIndex]}
      label={(value) => {
        const bucket = distribution[value];

        return bucket
          ? dayjs(bucket.start_timestamp).format(DATE_FORMAT)
          : null;
      }}
      onChange={([start, end]) => {
        onChange([
          //TODO: Find out why index shift is happening
          start === startIndex
            ? startTime
            : (distribution[start]?.start_timestamp ?? startTime),
          distribution[end]?.end_timestamp ?? endTime,
        ]);
      }}
    />
  );
};

const TimeFramePanel: FilterPanel<"time_frame"> = memo(
  ({ ocelId, filter, onChange, before }) => {
    const view = useView(ocelId, before);
    const { data: timeInfo, isLoading } = useTimeInfo(
      ocelId,
      { ...view, periods: 100 },
      {
        query: {
          enabled: view !== undefined,
          placeholderData: keepPreviousData,
        },
      },
    );
    const [start, end] = filter.time_range;
    const mode = filter.mode ?? "include";
    const setRange = (time_range: [string | null, string | null]) =>
      onChange({ ...filter, time_range });

    return (
      <Box pos={"relative"} w={"100%"} h={"100%"}>
        <LoadingOverlay visible={isLoading} />
        {timeInfo && (
          <Grid justify="center" align="center">
            <Grid.Col span={12}>
              <Group justify="flex-end">
                <SegmentedControl
                  size="xs"
                  data={MODE_OPTIONS}
                  value={mode}
                  onChange={(next) =>
                    onChange({ ...filter, mode: next as TimeFrameFilterMode })
                  }
                />
              </Group>
            </Grid.Col>
            <Grid.Col span={12}>
              <TimeGraph
                timeInfo={timeInfo}
                startDate={start ?? undefined}
                endDate={end ?? undefined}
                mode={mode}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <DateTimePicker
                minDate={timeInfo.start_time}
                maxDate={end ?? timeInfo.end_time}
                onChange={(newStart) => setRange([newStart, end])}
                value={start ?? timeInfo.start_time}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TimeFrameSlider
                onChange={setRange}
                timeInfo={timeInfo}
                startTime={start ?? timeInfo.start_time}
                endTime={end ?? timeInfo.end_time}
                mode={mode}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <DateTimePicker
                minDate={start ?? timeInfo.start_time}
                maxDate={timeInfo.end_time}
                onChange={(newEnd) => setRange([start, newEnd])}
                value={end ?? timeInfo.end_time}
              />
            </Grid.Col>
          </Grid>
        )}
      </Box>
    );
  },
);

const bound = (value: string | null, open: string) =>
  value ? dayjs(value).format(DATE_FORMAT) : open;

export const TimeFrameFilter: FilterKind<"time_frame"> = {
  title: "Timeframe",
  description:
    "Keeps only the events that occur within the selected time range, or with Exclude, removes them and keeps everything outside it. Use the date pickers or drag the range slider to set the start and end; the bar chart shows the event distribution over time, with kept events highlighted and removed events dimmed.",
  Panel: TimeFramePanel,
  create: () => ({
    type: "time_frame",
    time_range: [null, null],
    mode: "include",
  }),
  summary: ({ time_range: [start, end], mode }) =>
    start || end
      ? `${mode === "exclude" ? "Excluding " : ""}${bound(start, "start")} – ${bound(end, "end")}`
      : "No range set",
  isComplete: ({ time_range: [start, end] }) => start != null || end != null,
};
