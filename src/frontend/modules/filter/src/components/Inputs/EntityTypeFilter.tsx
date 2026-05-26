import { MultiSelect, Stack } from "@mantine/core";
import BarChartSelect from "../BarChartSelect";

export const EntityTypeFilterInput: React.FC<{
  selectedEntityTypes: string[];
  entityTypes: { key: string; value: number }[];
  label: string;
  onChange: (values: string[]) => void;
  showGraph?: boolean;
}> = ({
  entityTypes,
  onChange,
  showGraph = false,
  selectedEntityTypes,
  label,
}) => {
  return (
    <Stack pos={"relative"}>
      {showGraph && (
        <BarChartSelect
          selected={selectedEntityTypes}
          values={entityTypes ?? []}
          onSelect={(selectedValue) => {
            onChange(
              selectedEntityTypes.includes(selectedValue)
                ? selectedEntityTypes.filter((v) => v !== selectedValue)
                : [...selectedEntityTypes, selectedValue],
            );
          }}
        />
      )}

      <MultiSelect
        label={label}
        data={entityTypes.map(({ key }) => key)}
        value={selectedEntityTypes}
        searchable
        hidePickedOptions
        nothingFoundMessage={"No event type found"}
        onChange={(newValues) => onChange(newValues)}
        clearable
      />
    </Stack>
  );
};
