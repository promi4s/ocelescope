import {
  Box,
  Group,
  LoadingOverlay,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useTimeInfo } from "@ocelescope/api-base";
import {
  type RangeBin,
  type RangeValue,
  RangeView,
  type StepKind,
  type StepPanel,
  viewParams,
} from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TimeFrameFilter, TimeFrameFilterMode } from "../../../api/base";
import dayjs from "../../../util/dayjs";

const DATE_FORMAT = "YYYY-MM-DD HH:mm";
const PICKER_FORMAT = "YYYY-MM-DD HH:mm:ss";

const MODE_OPTIONS = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" },
];

const toTime = (value: string | number) => dayjs(value).valueOf();
const toDate = (value: number) => dayjs(value).format(PICKER_FORMAT);
const formatTime = (value: number) => dayjs(value).format(DATE_FORMAT);

const TimeFramePanel: StepPanel<TimeFrameFilter> = ({
  ocelId,
  viewId,
  step: filter,
  onChange,
}) => {
  const { data: timeInfo, isLoading } = useTimeInfo(
    ocelId,
    { ...viewParams(viewId), periods: 100 },
    { query: { placeholderData: keepPreviousData } },
  );
  const mode = filter.mode ?? "include";

  const bins = useMemo<RangeBin[]>(
    () =>
      (timeInfo?.date_distribution ?? []).map(
        ({ start_timestamp, end_timestamp, entity_count }) => ({
          start: toTime(start_timestamp),
          end: toTime(end_timestamp),
          count: Object.values(entity_count).reduce(
            (total, count) => total + count,
            0,
          ),
        }),
      ),
    [timeInfo],
  );

  if (!timeInfo) {
    return (
      <Box pos="relative" w="100%" h="100%">
        <LoadingOverlay visible={isLoading} />
      </Box>
    );
  }

  const min = toTime(timeInfo.start_time);
  const max = toTime(timeInfo.end_time);
  const [start, end] = filter.time_range;
  const value: RangeValue = [
    start != null ? toTime(start) : min,
    end != null ? toTime(end) : max,
  ];
  const setRange = ([low, high]: RangeValue) =>
    onChange({ ...filter, time_range: [toDate(low), toDate(high)] });

  return (
    <Stack gap="md">
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
      <RangeView
        bins={bins}
        min={min}
        max={max}
        value={value}
        onChange={setRange}
        exclude={mode === "exclude"}
        format={formatTime}
        inputs={
          <Group wrap="nowrap" align="end" gap="xs">
            <DateTimePicker
              flex={1}
              withSeconds
              value={toDate(value[0])}
              minDate={toDate(min)}
              maxDate={toDate(value[1])}
              onChange={(next) =>
                setRange([next ? toTime(next) : min, value[1]])
              }
            />
            <Text c="dimmed" size="sm" pb={8}>
              -
            </Text>
            <DateTimePicker
              flex={1}
              withSeconds
              value={toDate(value[1])}
              minDate={toDate(value[0])}
              maxDate={toDate(max)}
              onChange={(next) =>
                setRange([value[0], next ? toTime(next) : max])
              }
            />
          </Group>
        }
      />
    </Stack>
  );
};

const bound = (value: string | null, open: string) =>
  value ? dayjs(value).format(DATE_FORMAT) : open;

export const timeFrameKind: StepKind<TimeFrameFilter> = {
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
  validate: ({ time_range: [start, end] }) =>
    start != null || end != null ? {} : { time_range: "Set a start or an end" },
};
