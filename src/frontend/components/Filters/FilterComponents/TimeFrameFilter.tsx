import { useTimeInfo } from "@/api/fastapi/ocels/ocels";
import { Box, Grid, LoadingOverlay, RangeSlider } from "@mantine/core";
import { memo, useEffect, useMemo, useState } from "react";
import { BarChart } from "@mantine/charts";
import { DateTimePicker } from "@mantine/dates";
import dayjs from "dayjs";
import { EntityTimeInfo } from "@/api/fastapi-schemas";
import { Controller, Watch } from "react-hook-form";
import { FilterPageComponentProps } from "..";

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
      timeInfo.date_distribution.findIndex(({ end_timestamp }) =>
        dayjs(startTime).isBefore(dayjs(end_timestamp)),
      ),
    [startTime, timeInfo.date_distribution],
  );

  const endIndex = useMemo(
    () =>
      timeInfo.date_distribution.findLastIndex(({ start_timestamp }) =>
        dayjs(endTime).isAfter(dayjs(start_timestamp)),
      ),
    [endTime, timeInfo.date_distribution],
  );

  const [range, setRange] = useState<[number, number]>([startIndex, endIndex]);

  useEffect(() => {
    setRange([startIndex, endIndex]);
  }, [startIndex, endIndex]);

  const applyRangeToTime = ([start, end]: [number, number]) =>
    [
      dayjs(timeInfo.date_distribution[start].start_timestamp).toString(),
      dayjs(timeInfo.date_distribution[end].end_timestamp).toString(),
    ] as [string, string];

  return (
    <RangeSlider
      min={0}
      max={timeInfo.date_distribution.length - 1}
      minRange={0}
      value={range}
      label={(value) =>
        dayjs(timeInfo.date_distribution[value].start_timestamp).format(
          "YYYY-MM-DD HH:mm",
        )
      }
      onChange={(newRange) => {
        setRange(newRange);
        onChange(applyRangeToTime(newRange));
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
                      endTime={timeInfo.end_time}
                      startTime={timeInfo.start_time}
                      onChange={field.onChange}
                      timeInfo={timeInfo}
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
