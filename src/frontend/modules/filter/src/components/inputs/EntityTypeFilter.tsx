import {
  Group,
  MultiSelect,
  RangeSlider,
  ScrollArea,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useMemo, useState } from "react";
import BarChartSelect from "./BarChartSelect";

export type EntityTypeFilterMode = "include" | "exclude";

export const EntityTypeFilterInput: React.FC<{
  selectedEntityTypes: string[];
  entityTypes: { key: string; value: number }[];
  label: string;
  onChange: (values: string[]) => void;
  mode: EntityTypeFilterMode;
  onModeChange: (mode: EntityTypeFilterMode) => void;
  showGraph?: boolean;
}> = ({
  entityTypes,
  onChange,
  showGraph = false,
  selectedEntityTypes,
  label,
  mode,
  onModeChange,
}) => {
  const isExclude = mode === "exclude";

  const maxCount = useMemo(
    () => entityTypes.reduce((max, { value }) => Math.max(max, value), 0),
    [entityTypes],
  );
  const [range, setRange] = useState<[number, number]>([0, 100]);

  const frequencyMarks = useMemo(() => {
    if (maxCount === 0) return [];
    const percentages = new Set(
      entityTypes.map(({ value }) => Math.round((value / maxCount) * 100)),
    );
    return Array.from(percentages).map((value) => ({ value }));
  }, [entityTypes, maxCount]);

  const applyRange = ([low, high]: [number, number]) => {
    setRange([low, high]);
    const minCount = (low / 100) * maxCount;
    const maxCountInBand = (high / 100) * maxCount;
    const inBand = (count: number) =>
      count >= minCount && count <= maxCountInBand;
    onChange(
      entityTypes
        .filter(({ value: count }) =>
          isExclude ? !inBand(count) : inBand(count),
        )
        .map(({ key }) => key),
    );
  };

  const highlighted = isExclude
    ? entityTypes
        .map(({ key }) => key)
        .filter((key) => !selectedEntityTypes.includes(key))
    : selectedEntityTypes;

  const toggle = (key: string) =>
    onChange(
      selectedEntityTypes.includes(key)
        ? selectedEntityTypes.filter((v) => v !== key)
        : [...selectedEntityTypes, key],
    );

  return (
    <Stack gap={"md"}>
      {showGraph && (
        <Stack gap={"xs"} style={{ minHeight: 0 }}>
          <ScrollArea.Autosize mah={"60vh"} type={"auto"}>
            <BarChartSelect
              selected={highlighted}
              values={entityTypes ?? []}
              onSelect={toggle}
            />
          </ScrollArea.Autosize>

          <Stack gap={2}>
            <Text size={"sm"} fw={500}>
              Frequency range (% of most frequent)
            </Text>
            <RangeSlider
              min={0}
              max={100}
              value={range}
              onChange={applyRange}
              disabled={maxCount === 0}
              label={(value) => `${value}%`}
              minRange={0}
              marks={frequencyMarks}
              inverted={mode === "include"}
              mb={"sm"}
            />
          </Stack>
        </Stack>
      )}

      <Group align={"flex-end"} gap={"sm"} wrap={"nowrap"}>
        <MultiSelect
          flex={1}
          label={isExclude ? `Excluded ${label}` : label}
          data={entityTypes.map(({ key }) => key)}
          value={selectedEntityTypes}
          searchable
          hidePickedOptions
          nothingFoundMessage={"No event type found"}
          onChange={(newValues) => onChange(newValues)}
          clearable
          styles={{
            input: {
              flexWrap: "nowrap",
              overflowX: "auto",
              overflowY: "hidden",
            },
          }}
        />
        <Switch
          mb={8}
          label={"Exclude"}
          checked={isExclude}
          onChange={(event) =>
            onModeChange(event.currentTarget.checked ? "exclude" : "include")
          }
        />
      </Group>
    </Stack>
  );
};
