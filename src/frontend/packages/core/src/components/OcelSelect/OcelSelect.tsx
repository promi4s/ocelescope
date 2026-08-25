import {
  Combobox,
  Group,
  Input,
  InputBase,
  type MantineStyleProps,
  Text,
  Tooltip,
  useCombobox,
} from "@mantine/core";
import { useGetOcels } from "@ocelescope/api-base";
import { FilterIcon } from "lucide-react";
import { useMemo } from "react";
import { useCurrentOcel } from "../../hooks/useCurrentOCEL";

const FilteredIndicator: React.FC = () => (
  <Tooltip label="This log has been filtered">
    <FilterIcon size={14} color="var(--mantine-color-blue-6)" />
  </Tooltip>
);

export type OcelSelectProps = {
  extension?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  clearable?: boolean;
  required?: boolean;
  disabled?: boolean;
  w?: MantineStyleProps["w"];
};

export const OcelSelect: React.FC<OcelSelectProps> = ({
  extension,
  value,
  onChange,
  clearable,
  disabled,
  placeholder = "Select an OCEL",
  ...inputProps
}) => {
  const { data } = useGetOcels(extension ? { extension_name: extension } : {});

  const ocels = useMemo(() => data ?? [], [data]);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const selected = useMemo(
    () => ocels.find((ocel) => ocel.id === value),
    [ocels, value],
  );

  const showClearButton = clearable && !disabled && value != null;

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        onChange?.(val);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          {...inputProps}
          component="button"
          type="button"
          pointer
          disabled={disabled}
          rightSection={
            showClearButton ? (
              <Combobox.ClearButton onClear={() => onChange?.(null)} />
            ) : (
              <Combobox.Chevron />
            )
          }
          rightSectionPointerEvents={showClearButton ? "all" : "none"}
          onClick={() => combobox.toggleDropdown()}
        >
          {selected ? (
            <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
              <Text span size="sm" truncate>
                {selected.name}
              </Text>
              {selected.filter_applied && <FilteredIndicator />}
            </Group>
          ) : (
            <Input.Placeholder>{placeholder}</Input.Placeholder>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {ocels.map((ocel) => (
            <Combobox.Option value={ocel.id} key={ocel.id}>
              <Group gap={6} wrap="nowrap">
                {ocel.name}
                {ocel.filter_applied && <FilteredIndicator />}
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};

export const CurrentOcelSelect: React.FC = () => {
  const { id, setCurrentOcel } = useCurrentOcel();

  return (
    <OcelSelect
      value={id}
      w={250}
      onChange={(id) => {
        if (id) {
          setCurrentOcel(id);
        }
      }}
    />
  );
};
