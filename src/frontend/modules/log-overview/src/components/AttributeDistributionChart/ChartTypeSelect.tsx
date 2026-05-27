import { Select } from "@mantine/core";

import type { ChartType } from "./types";

interface Props {
  options: readonly { value: ChartType; label: string }[];
  value: ChartType;
  onChange: (v: ChartType) => void;
}

export function ChartTypeSelect({ options, value, onChange }: Props) {
  return (
    <Select
      size="xs"
      w={130}
      data={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      onChange={(v) => v && onChange(v as ChartType)}
      allowDeselect={false}
    />
  );
}
