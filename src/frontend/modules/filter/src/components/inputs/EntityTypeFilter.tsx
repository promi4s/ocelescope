import { Group, MultiSelect, Stack, Switch } from "@mantine/core";

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
  selectedEntityTypes,
  label,
  mode,
  onModeChange,
}) => {
  const isExclude = mode === "exclude";

  return (
    <Stack gap={"md"}>
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
