import { Group, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useMemo } from "react";
import dayjs from "../../../../../util/dayjs";
import RangeView, { type Bin, type Range } from "../../../../RangeView";
import type { DistributionViewProps } from "../../util";

const PICKER_FORMAT = "YYYY-MM-DD HH:mm:ss";

const toTime = (value: string | number) => dayjs(value).valueOf();

const toDate = (value: number) => dayjs(value).format(PICKER_FORMAT);

const formatTime = (value: number) => dayjs(value).format("YYYY-MM-DD HH:mm");

const DateRangeView: React.FC<DistributionViewProps> = ({
  data,
  filter,
  onChange,
}) => {
  const min = toTime(data.min);
  const max = toTime(data.max);

  const bins = useMemo<Bin[]>(
    () =>
      (data.bins ?? []).map(({ start, end, count }) => ({
        start: toTime(start),
        end: toTime(end),
        count,
      })),
    [data.bins],
  );

  const [start, end] = filter.time_range ?? [null, null];
  const value: Range = [
    start != null ? toTime(start) : min,
    end != null ? toTime(end) : max,
  ];
  const setRange = ([low, high]: Range) =>
    onChange({ ...filter, time_range: [toDate(low), toDate(high)] });

  return (
    <RangeView
      bins={bins}
      min={min}
      max={max}
      value={value}
      onChange={setRange}
      exclude={filter.mode === "exclude"}
      format={formatTime}
      inputs={
        <Group wrap="nowrap" align="end" gap="xs">
          <DateTimePicker
            flex={1}
            withSeconds
            value={toDate(value[0])}
            minDate={toDate(min)}
            maxDate={toDate(value[1])}
            onChange={(next) => setRange([next ? toTime(next) : min, value[1]])}
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
            onChange={(next) => setRange([value[0], next ? toTime(next) : max])}
          />
        </Group>
      }
    />
  );
};

export default DateRangeView;
