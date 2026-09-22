import { Badge, Group, Loader, MultiSelect, Text } from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import type { PluginOutput } from "@ocelescope/api-base";
import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

const ResultLabel: React.FC<{
  label: string;
  entityType: string;
  bold?: boolean;
}> = ({ label, entityType, bold }) => (
  <Group gap="xs" wrap="nowrap" miw={0} flex={1}>
    <Text fw={bold ? 600 : undefined} truncate>
      {label}
    </Text>
    <Badge
      size="sm"
      color={generateColor(entityType)}
      style={{ flexShrink: 0 }}
    >
      {entityType}
    </Badge>
  </Group>
);

export const SelectionAction = ({
  output,
  selectedOutputs,
  setSelectedOutputs,
  isLoading,
}: {
  output: PluginOutput[];
  isLoading?: boolean;
  selectedOutputs: number[];
  setSelectedOutputs: (newSelection: number[]) => void;
}) => {
  const options = useMemo(
    () =>
      (output ?? []).map((output) => {
        return {
          value: output.result_index,
          label: output.default_name,
          entityType: output.type_label,
        };
      }),
    [output],
  );

  const entityTypeByValue = useMemo(
    () => new Map(options.map(({ value, entityType }) => [value, entityType])),
    [options],
  );

  return isLoading ? (
    <Group gap="xs" align="center" wrap="nowrap">
      <Text>Loading</Text>
      <Loader size={"xs"} />
    </Group>
  ) : options.length > 1 ? (
    <MultiSelect
      flex={1}
      miw={0}
      data={options}
      onChange={setSelectedOutputs}
      value={selectedOutputs}
      placeholder="Select results to display"
      searchable
      clearable
      comboboxProps={{ withinPortal: true }}
      styles={{
        pillsList: {
          flexWrap: "nowrap",
          overflowX: "auto",
          scrollbarWidth: "none",
        },
        pill: { flexShrink: 0 },
        inputField: { minWidth: 80 },
      }}
      renderOption={({ option, checked }) => {
        return (
          <Group align="center" wrap="nowrap" gap="xs">
            {checked && (
              <CheckIcon size={16} color="grey" style={{ flexShrink: 0 }} />
            )}
            <ResultLabel
              label={option.label}
              entityType={entityTypeByValue.get(option.value) ?? ""}
            />
          </Group>
        );
      }}
    />
  ) : (
    options[0] && (
      <ResultLabel
        label={options[0].label}
        entityType={options[0].entityType}
        bold
      />
    )
  );
};
