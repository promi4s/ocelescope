import { Group, NumberInput, Text } from "@mantine/core";
import { useMemo } from "react";
import RangeView, { type Bin, type Range } from "../../../../RangeView";
import type { DistributionViewProps } from "../../util";

const formatInt = (value: number) => value.toLocaleString();

const formatFloat = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const NumberRangeView: React.FC<DistributionViewProps> = ({
  data,
  filter,
  onChange,
}) => {
  const isInt = data.type === "int";
  const min = Number(data.min);
  const max = Number(data.max);

  const bins = useMemo<Bin[]>(
    () =>
      (data.bins ?? []).map(({ start, end, count }, index, all) => ({
        start: Number(start),
        end: isInt && index < all.length - 1 ? Number(end) - 1 : Number(end),
        count,
      })),
    [data.bins, isInt],
  );

  const [low, high] = filter.number_range ?? [null, null];
  const value: Range = [low ?? min, high ?? max];
  const setRange = (number_range: Range) =>
    onChange({ ...filter, number_range });

  const toNumber = (next: string | number) =>
    typeof next === "number" ? next : undefined;

  return (
    <RangeView
      bins={bins}
      min={min}
      max={max}
      value={value}
      onChange={setRange}
      exclude={filter.mode === "exclude"}
      format={isInt ? formatInt : formatFloat}
      snap={isInt ? Math.round : undefined}
      inputs={
        <Group wrap="nowrap" align="end" gap="xs">
          <NumberInput
            flex={1}
            value={value[0]}
            min={min}
            max={value[1]}
            allowDecimal={!isInt}
            onChange={(next) => setRange([toNumber(next) ?? min, value[1]])}
          />
          <Text c="dimmed" size="sm" pb={8}>
            -
          </Text>
          <NumberInput
            flex={1}
            value={value[1]}
            min={value[0]}
            max={max}
            allowDecimal={!isInt}
            onChange={(next) => setRange([value[0], toNumber(next) ?? max])}
          />
        </Group>
      }
    />
  );
};

export default NumberRangeView;
