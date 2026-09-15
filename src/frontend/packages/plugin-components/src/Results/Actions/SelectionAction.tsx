import { Badge, Group, MultiSelect, Text } from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import type { PluginOutput } from "@ocelescope/api-base";
import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

const ResultLabel: React.FC<{
  label: string;
  entityType: string;
  bold?: boolean;
}> = ({ label, entityType, bold }) => (
  <Group gap="xs" wrap="nowrap">
    <Text fw={bold ? 600 : undefined} truncate maw={120}>
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
}: {
  output: PluginOutput[];
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

  return options.length > 1 ? (
    <MultiSelect
      flex={1}
      data={options}
      onChange={setSelectedOutputs}
      value={selectedOutputs}
      placeholder="Select results to display"
      searchable
      clearable
      comboboxProps={{ withinPortal: true }}
      renderOption={({ option, checked }) => {
        return (
          <Group align="center">
            {checked && <CheckIcon size={16} color="grey" />}
            <ResultLabel label={option.label} entityType={option.label} />
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
