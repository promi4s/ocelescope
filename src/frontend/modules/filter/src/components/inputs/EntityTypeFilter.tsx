import { Group, MultiSelect, Stack, Switch } from "@mantine/core";
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
    <Stack pos={"relative"}>
      {showGraph && (
        <BarChartSelect
          selected={highlighted}
          values={entityTypes ?? []}
          onSelect={toggle}
        />
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
