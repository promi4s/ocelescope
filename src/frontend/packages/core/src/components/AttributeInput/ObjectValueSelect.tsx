import { Group, Select } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import dayjs from "../../lib/dayjs";
import type { ObjectValue } from "./types";

const VALUE_OPTIONS = [
  { value: "first", label: "First value" },
  { value: "initial", label: "Initial value" },
  { value: "last", label: "Last value" },
  { value: "at", label: "Value at a time" },
];

const PICKER_FORMAT = "YYYY-MM-DD HH:mm:ss";

const toObjectValue = (kind: string, previous?: ObjectValue): ObjectValue => {
  switch (kind) {
    case "initial":
      return { kind: "initial" };
    case "last":
      return { kind: "last" };
    case "at":
      return {
        kind: "at",
        timestamp:
          previous?.kind === "at"
            ? previous.timestamp
            : dayjs().format(PICKER_FORMAT),
      };
    default:
      return { kind: "first" };
  }
};

type ObjectValueSelectProps = {
  value: ObjectValue | undefined;
  onChange: (value: ObjectValue) => void;
};

const ObjectValueSelect: React.FC<ObjectValueSelectProps> = ({
  value,
  onChange,
}) => (
  <Group gap="sm" wrap="nowrap" align="end">
    <Select
      size="xs"
      w={160}
      label="Value"
      allowDeselect={false}
      data={VALUE_OPTIONS}
      value={value?.kind ?? "first"}
      onChange={(next) => next && onChange(toObjectValue(next, value))}
    />
    {value?.kind === "at" && (
      <DateTimePicker
        size="xs"
        withSeconds
        label="At"
        value={dayjs(value.timestamp).format(PICKER_FORMAT)}
        onChange={(next) =>
          next &&
          onChange({ kind: "at", timestamp: dayjs(next).format(PICKER_FORMAT) })
        }
      />
    )}
  </Group>
);

export default ObjectValueSelect;
