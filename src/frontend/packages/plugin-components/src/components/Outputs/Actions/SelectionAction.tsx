import { Badge, Group, MultiSelect, Text } from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import type { PluginOutput } from "@ocelescope/api-base";
import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

const OutputLabel: React.FC<{
  label: string;
  typeLabel: string;
  bold?: boolean;
}> = ({ label, typeLabel, bold }) => (
  <Group gap="xs" wrap="nowrap" miw={0} flex={1}>
    <Text fw={bold ? 600 : undefined} truncate>
      {label}
    </Text>
    <Badge size="sm" color={generateColor(typeLabel)} style={{ flexShrink: 0 }}>
      {typeLabel}
    </Badge>
  </Group>
);

export const SelectionAction = ({
  outputs,
  value,
  onChange,
}: {
  outputs: PluginOutput[];
  value: number[];
  onChange: (outputIndices: number[]) => void;
}) => {
  const options = useMemo(
    () =>
      outputs.map(({ result_index, default_name, type_label }) => ({
        value: result_index,
        label: default_name,
        typeLabel: type_label,
      })),
    [outputs],
  );

  const typeLabelByValue = useMemo(
    () => new Map(options.map(({ value, typeLabel }) => [value, typeLabel])),
    [options],
  );

  return options.length > 1 ? (
    <MultiSelect
      flex={1}
      miw={0}
      data={options}
      onChange={onChange}
      value={value}
      placeholder="Select outputs to display"
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
            <OutputLabel
              label={option.label}
              typeLabel={typeLabelByValue.get(option.value) ?? ""}
            />
          </Group>
        );
      }}
    />
  ) : (
    options[0] && (
      <OutputLabel
        label={options[0].label}
        typeLabel={options[0].typeLabel}
        bold
      />
    )
  );
};
