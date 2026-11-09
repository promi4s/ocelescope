import { Group, NumberInput, Text } from "@mantine/core";
import { useMemo } from "react";
import RangeView, { type Bin, type Range } from "../../RangeView";
import { useAttributeBins } from "../hooks";
import type { ViewProps } from "../types";

const formatInt = (value: number) => value.toLocaleString();

const formatFloat = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const NumberRangeView: React.FC<ViewProps> = ({
  summary,
  value: filterValue,
  onChange,
  inverted,
  objectValue,
  ...scope
}) => {
  const { data } = useAttributeBins(scope, objectValue);

  const isInt = summary.type === "int";
  const min = Number(summary.min ?? 0);
  const max = Number(summary.max ?? 0);

  const bins = useMemo<Bin[]>(
    () =>
      (data ?? []).map(({ start, end, count }, index, all) => ({
        start: Number(start),
        end: isInt && index < all.length - 1 ? Number(end) - 1 : Number(end),
        count,
      })),
    [data, isInt],
  );

  const current = filterValue;
  const [low, high] = current?.kind === "range" ? current.range : [null, null];
  const value: Range = [low ?? min, high ?? max];
  const setRange = (range: Range) => onChange({ kind: "range", range });

  const toNumber = (next: string | number) =>
    typeof next === "number" ? next : undefined;

  return (
    <RangeView
      bins={bins}
      min={min}
      max={max}
      value={value}
      onChange={setRange}
      exclude={inverted}
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
