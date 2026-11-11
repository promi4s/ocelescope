import { Group, NumberInput, SimpleGrid, Stack, Text } from "@mantine/core";
import type { RelationCountDistribution } from "@ocelescope/api-base";
import {
  type RangeBin as Bin,
  type RangeValue as Range,
  RangeView,
} from "@ocelescope/core";
import { useMemo } from "react";

export type CountRangeProps = {
  data: RelationCountDistribution;
  value: [number | null, number | null];
  onChange: (range: Range) => void;
  countedLabel: string;
  caption: string;
  exclude?: boolean;
};

const formatCount = (value: number) => value.toLocaleString();

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Stack gap={0} miw={0}>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text size="sm" fw={500}>
      {value.toLocaleString()}
    </Text>
  </Stack>
);

const CountRange: React.FC<CountRangeProps> = ({
  data,
  value: [low, high],
  onChange,
  countedLabel,
  caption,
  exclude = false,
}) => {
  const bins = useMemo<Bin[]>(
    () =>
      data.bins.map(({ start, end, count }, index, all) => ({
        start: Number(start),
        end: index < all.length - 1 ? Number(end) - 1 : Number(end),
        count,
      })),
    [data.bins],
  );

  const value: Range = [low ?? data.min, high ?? data.max];

  return (
    <Stack gap="md">
      <SimpleGrid cols={4}>
        <Stat label={countedLabel} value={data.entities} />
        <Stat label="Relations" value={data.relations} />
        <Stat label="Min" value={data.min} />
        <Stat label="Max" value={data.max} />
      </SimpleGrid>
      <Text size="sm" c="dimmed">
        {caption}
      </Text>
      <RangeView
        bins={bins}
        min={data.min}
        max={data.max}
        value={value}
        onChange={onChange}
        format={formatCount}
        snap={Math.round}
        exclude={exclude}
        inputs={
          <Group wrap="nowrap" align="end" gap="xs">
            <NumberInput
              flex={1}
              value={value[0]}
              min={data.min}
              max={value[1]}
              allowDecimal={false}
              onChange={(next) =>
                onChange([typeof next === "number" ? next : data.min, value[1]])
              }
            />
            <Text c="dimmed" size="sm" pb={8}>
              -
            </Text>
            <NumberInput
              flex={1}
              value={value[1]}
              min={value[0]}
              max={data.max}
              allowDecimal={false}
              onChange={(next) =>
                onChange([value[0], typeof next === "number" ? next : data.max])
              }
            />
          </Group>
        }
      />
    </Stack>
  );
};

export default CountRange;
