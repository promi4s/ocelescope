import { ActionIcon, Group, Popover, Text } from "@mantine/core";
import { useColorOf } from "@r4pm/components";
import { FilterIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { OptionPicker } from "../Pickers";

export type ScopePickerProps = {
  label: string;
  colorScope: "activity" | "objectType";
  counts: Record<string, number>;
  value: string[];
  onChange: (value: string[]) => void;
};

const ScopePicker: React.FC<ScopePickerProps> = ({
  label,
  colorScope,
  counts,
  value,
  onChange,
}) => {
  const colorOf = useColorOf(colorScope);
  const [search, setSearch] = useState("");
  const options = useMemo(
    () =>
      Object.entries(counts).map(([name, count]) => ({
        value: name,
        label: name,
        count,
        color: colorOf(name),
      })),
    [counts, colorOf],
  );
  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query === ""
      ? options
      : options.filter(({ label }) => label.toLowerCase().includes(query));
  }, [options, search]);

  return (
    <Group gap={4}>
      <Text size="xs" c="dimmed">
        {label}: {value.length} / {options.length}
      </Text>
      <Popover width={260} position="bottom" withArrow shadow="md">
        <Popover.Target>
          <ActionIcon size="md" variant="transparent">
            <FilterIcon size={16} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <OptionPicker<string>
            options={shown}
            variant="list"
            multiple
            cutoff
            search={search}
            onSearch={setSearch}
            value={value}
            onChange={(next) => onChange([...next])}
          />
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
};

export default ScopePicker;
