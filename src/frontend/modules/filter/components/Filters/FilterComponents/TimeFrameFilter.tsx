import { useTimeInfo } from "@/api/fastapi/ocels/ocels";
import { Box, Grid, LoadingOverlay, RangeSlider } from "@mantine/core";
import { memo, useMemo } from "react";
import { BarChart } from "@mantine/charts";
import { DateTimePicker } from "@mantine/dates";
import dayjs from "@/util/dayjs";
import type { EntityTimeInfo } from "@/api/fastapi-schemas";
import { Controller, Watch } from "react-hook-form";
import type { FilterPageComponentProps } from "..";

const TimeGraph: React.FC<{
  timeInfo: EntityTimeInfo;
  startDate?: string;
  endDate?: string;
}> = memo(({ timeInfo, startDate, endDate }) => {
  const data = useMemo(() => {
    const data = timeInfo.date_distribution.map(
      ({ start_timestamp, end_timestamp, entity_count }) => {
        const isInRange =
          (!startDate || dayjs(end_timestamp).isAfter(dayjs(startDate))) &&
          (!endDate || dayjs(start_timestamp).isBefore(dayjs(endDate)));

        return {
          date: `${dayjs(start_timestamp).format("YYYY-MM-DD HH:mm")}-${dayjs(end_timestamp).format("YYYY-MM-DD HH:mm")} `,
          ...(isInRange
            ? {
                value: Object.values(entity_count).reduce(
                  (acc, curr) => acc + curr,
                  0,
                ),
              }
            : {
                disabledValue: Object.values(entity_count).reduce(
                  (acc, curr) => acc + curr,
                  0,
                ),
              }),
        };
      },
    );

    return data;
  }, [timeInfo, startDate, endDate]);

  return (
    <BarChart
      h={300}
      w={"100%"}
      data={data}
      dataKey="date"
      type="stacked"
      series={[
        { name: "value", color: "blue", label: "count" },
        { name: "disabledValue", color: "red", label: "count" },
      ]}
      withYAxis={false}
      withXAxis={false}
      barChartProps={{ barCategoryGap: 0, barGap: 0 }}
    />
  );
});

const TimeFrameSlider: React.FC<{
  timeInfo: EntityTimeInfo;
  startTime: string;
  endTime: string;
  onChange: (newTimeFrame: [string, string]) => void;
}> = ({ timeInfo, startTime, endTime, onChange }) => {
  const startIndex = useMemo(
    () =>
      timeInfo.date_distribution.findIndex(
        ({ start_timestamp, end_timestamp }) =>
          dayjs(startTime).isBetween(
            start_timestamp,
            end_timestamp,
            null,
            "[)",
          ),
      ),
    [startTime, timeInfo.date_distribution],
  );

  const endIndex = useMemo(
    () =>
      timeInfo.date_distribution.findLastIndex(
        ({ start_timestamp, end_timestamp }) =>
          dayjs(endTime).isBetween(start_timestamp, end_timestamp, null, "(]"),
      ),
    [endTime, timeInfo.date_distribution],
  );

  return (
    <RangeSlider
      min={0}
      max={timeInfo.date_distribution.length - 1}
      minRange={0}
      value={[startIndex, endIndex]}
      label={(value) =>
        dayjs(timeInfo.date_distribution[value].start_timestamp).format(
          "YYYY-MM-DD HH:mm",
        )
      }
      onChange={([start, end]) => {
        onChange([
          //TODO: Find out why index shift is happening
          start === startIndex
            ? startTime
            : timeInfo.date_distribution[start].start_timestamp,
          timeInfo.date_distribution[end].end_timestamp,
        ]);
      }}
    />
  );
};

const TimeFrameFilter: React.FC<FilterPageComponentProps> = memo(
  ({ ocelParams, control }) => {
    const { data: timeInfo, isLoading } = useTimeInfo({
      periods: 100,
      ...ocelParams,
    });

    return (
      <Box pos={"relative"} w={"100%"} h={"100%"}>
        <LoadingOverlay visible={isLoading} />
        {timeInfo && (
          <Grid justify="center" align="center">
            <Grid.Col span={12}>
              <Watch
                control={control}
                names={
                  [
                    "time_range.time_range.0",
                    "time_range.time_range.1",
                  ] as const
                }
                render={([startTime, endTime]) => {
                  return (
                    <TimeGraph
                      timeInfo={timeInfo}
                      startDate={startTime ?? undefined}
                      endDate={endTime ?? undefined}
                    />
                  );
                }}
              />
            </Grid.Col>
            <Controller
              control={control}
              name={"time_range.time_range"}
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
                      value={field.value?.[0]}
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
                      value={field.value?.[1]}
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

export default TimeFrameFilter;
