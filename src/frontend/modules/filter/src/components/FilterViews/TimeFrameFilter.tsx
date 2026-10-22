import {
  Box,
  Grid,
  LoadingOverlay,
  RangeSlider,
  useMantineTheme,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { EntityTimeInfo } from "@ocelescope/api-base";
import { useTimeInfo } from "@ocelescope/api-base";
import type { EChartsOption } from "echarts";
import EChartsReact from "echarts-for-react";
import { memo, useMemo } from "react";
import type { FilterKind, FilterPanel } from "../../types/filter";
import dayjs from "../../util/dayjs";

const DATE_FORMAT = "YYYY-MM-DD HH:mm";

const TimeGraph: React.FC<{
  timeInfo: EntityTimeInfo;
  startDate?: string;
  endDate?: string;
}> = memo(({ timeInfo, startDate, endDate }) => {
  const theme = useMantineTheme();

  const option: EChartsOption = useMemo(() => {
    const buckets = timeInfo.date_distribution.map(
      ({ start_timestamp, end_timestamp, entity_count }) => ({
        label: `${dayjs(start_timestamp).format(DATE_FORMAT)} - ${dayjs(end_timestamp).format(DATE_FORMAT)}`,
        count: Object.values(entity_count).reduce((acc, curr) => acc + curr, 0),
        isInRange:
          (!startDate || dayjs(end_timestamp).isAfter(dayjs(startDate))) &&
          (!endDate || dayjs(start_timestamp).isBefore(dayjs(endDate))),
      }),
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
          data: buckets.map(({ count, isInRange }) => ({
            value: count,
            itemStyle: {
              color: theme.colors.blue[6],
              opacity: isInRange ? 1 : 0.25,
            },
          })),
        },
      ],
    };
  }, [timeInfo, startDate, endDate, theme]);

  return <EChartsReact option={option} style={{ height: 300 }} />;
});

const TimeFrameSlider: React.FC<{
  timeInfo: EntityTimeInfo;
  startTime: string;
  endTime: string;
  onChange: (newTimeFrame: [string, string]) => void;
}> = ({ timeInfo, startTime, endTime, onChange }) => {
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
  ({ ocelId, filter, onChange }) => {
    const { data: timeInfo, isLoading } = useTimeInfo(ocelId, {
      periods: 100,
      ocel_version: "original",
    });
    const [start, end] = filter.time_range;
    const setRange = (time_range: [string | null, string | null]) =>
      onChange({ ...filter, time_range });

    return (
      <Box pos={"relative"} w={"100%"} h={"100%"}>
        <LoadingOverlay visible={isLoading} />
        {timeInfo && (
          <Grid justify="center" align="center">
            <Grid.Col span={12}>
              <TimeGraph
                timeInfo={timeInfo}
                startDate={start ?? undefined}
                endDate={end ?? undefined}
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
    "Keeps only the events that occur within the selected time range. Use the date pickers or drag the range slider to set the start and end; the bar chart shows the event distribution over time, with events inside the range highlighted and events outside it dimmed.",
  Panel: TimeFramePanel,
  create: () => ({ type: "time_frame", time_range: [null, null] }),
  summary: ({ time_range: [start, end] }) =>
    start || end
      ? `${bound(start, "start")} – ${bound(end, "end")}`
      : "No range set",
  isComplete: ({ time_range: [start, end] }) => start != null || end != null,
};
