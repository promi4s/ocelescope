import { Box, Grid, LoadingOverlay, RangeSlider } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { EntityTimeInfo } from "@ocelescope/api-base";
import { useTimeInfo } from "@ocelescope/api-base";
import { memo, useMemo } from "react";
import { Controller, Watch } from "react-hook-form";
import type { FilterView, FilterViewType } from "../../types/filter";
import dayjs from "../../util/dayjs";

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
          ? dayjs(bucket.start_timestamp).format("YYYY-MM-DD HH:mm")
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

const TimeFrameFilterView: FilterView<"time_frame"> = memo(
  ({ ocelId, control }) => {
    const { data: timeInfo, isLoading } = useTimeInfo(ocelId, {
      periods: 100,
      ocel_version: "original",
    });

    return (
      <Box pos={"relative"} w={"100%"} h={"100%"}>
        <LoadingOverlay visible={isLoading} />
        {timeInfo && (
          <Grid justify="center" align="center">
            <Grid.Col span={12}>
              <Watch
                control={control}
                name={
                  [
                    "time_frame.0.time_range.0",
                    "time_frame.0.time_range.1",
                  ] as const
                }
                render={() => {
                  return <></>;
                }}
              />
            </Grid.Col>
            <Controller
              control={control}
              name={"time_frame.0.time_range"}
              defaultValue={[timeInfo.start_time, timeInfo.end_time]}
              render={({ field }) => (
                <>
                  <Grid.Col span={3}>
                    <DateTimePicker
                      minDate={timeInfo.start_time}
                      maxDate={field.value?.[1] ?? timeInfo.end_time}
                      onChange={(newStart) => {
                        field.onChange([newStart, field.value?.[1]]);
                      }}
                      value={field.value?.[0] ?? timeInfo.start_time}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TimeFrameSlider
                      onChange={field.onChange}
                      timeInfo={timeInfo}
                      startTime={field.value?.[0] ?? timeInfo.start_time}
                      endTime={field.value?.[1] ?? timeInfo.end_time}
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <DateTimePicker
                      minDate={field.value?.[0] ?? timeInfo.start_time}
                      maxDate={timeInfo.end_time}
                      onChange={(newEnd) => {
                        field.onChange([field.value?.[0], newEnd]);
                      }}
                      value={field.value?.[1] ?? timeInfo.end_time}
                    />
                  </Grid.Col>
                </>
              )}
            />
          </Grid>
        )}
      </Box>
    );
  },
);

export const TimeFrameFilter: FilterViewType<"time_frame"> = {
  title: "Timeframe",
  description:
    "Filters events by their timestamp, keeping only those that occur within the selected time range. Use the date pickers or drag the range slider to set the start and end; the bar chart shows the event distribution over time, with events inside the range highlighted and events outside it dimmed.",
  ViewComponent: TimeFrameFilterView,
  generateDefault: () => [{ type: "time_frame", time_range: [null, null] }],
  cleanUpFilters: (currentFilter) => {
    if (
      !currentFilter[0] ||
      (currentFilter[0].time_range[0] == null &&
        currentFilter[0].time_range[1] == null)
    ) {
      return [];
    }

    return [currentFilter[0]];
  },
};
