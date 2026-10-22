import { Group, NumberInput, Text, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { TypedAttribute } from "@ocelescope/api-base";
import { memo } from "react";
import type { FilterOf } from "../../types/filter";

type AttributeFilter = FilterOf<"event_attribute" | "object_attribute">;

type FieldProps = {
  filter: AttributeFilter;
  onChange: (filter: AttributeFilter) => void;
};

const StringFilterField = ({ filter, onChange }: FieldProps) => (
  <TextInput
    value={filter.regex ?? ""}
    onChange={(event) => onChange({ ...filter, regex: event.target.value })}
    placeholder="Enter regex"
  />
);

const NumberFilterField = ({
  filter,
  onChange,
  min,
  max,
  allowDecimals,
}: FieldProps & { min: number; max: number; allowDecimals?: boolean }) => {
  const currentMin =
    typeof filter.number_range?.[0] === "number"
      ? filter.number_range[0]
      : undefined;
  const currentMax =
    typeof filter.number_range?.[1] === "number"
      ? filter.number_range[1]
      : undefined;

  const setRange = (low: number | undefined, high: number | undefined) =>
    onChange({ ...filter, number_range: [low ?? null, high ?? null] });

  return (
    <Group wrap="nowrap" align="end" gap="xs">
      <NumberInput
        value={currentMin}
        min={min}
        max={currentMax ?? max}
        onChange={(next) =>
          setRange(typeof next === "number" ? next : undefined, currentMax)
        }
        allowDecimal={allowDecimals}
        style={{ flex: 1 }}
      />
      <Text c="dimmed" size="sm" pb={8}>
        -
      </Text>
      <NumberInput
        value={currentMax}
        min={currentMin ?? min}
        max={max}
        allowDecimal={allowDecimals}
        onChange={(next) =>
          setRange(currentMin, typeof next === "number" ? next : undefined)
        }
        style={{ flex: 1 }}
      />
    </Group>
  );
};

const DateFilterField = ({
  filter,
  onChange,
  min,
  max,
}: FieldProps & { min: string; max: string }) => {
  const [start, end] = filter.time_range ?? [null, null];

  return (
    <Group wrap="nowrap" align="end" gap="xs">
      <DateTimePicker
        value={start ?? undefined}
        minDate={min}
        maxDate={end ?? max}
        withSeconds
        onChange={(next) =>
          onChange({ ...filter, time_range: [next, end ?? max] })
        }
        style={{ flex: 1 }}
      />
      <Text c="dimmed" size="sm" pb={8}>
        -
      </Text>
      <DateTimePicker
        value={end ?? undefined}
        minDate={start ?? min}
        maxDate={max}
        withSeconds
        onChange={(next) =>
          onChange({ ...filter, time_range: [start ?? min, next] })
        }
        style={{ flex: 1 }}
      />
    </Group>
  );
};

export const AttributeInputField = memo(function AttributeInputField({
  record,
  filter,
  onChange,
}: FieldProps & { record: Omit<TypedAttribute, "name" | "entity_type"> }) {
  switch (record.type) {
    case "string":
      return <StringFilterField filter={filter} onChange={onChange} />;
    case "int":
      return (
        <NumberFilterField
          filter={filter}
          onChange={onChange}
          min={Number.parseInt(`${record.min}`, 10)}
          max={Number.parseInt(`${record.max}`, 10)}
          allowDecimals={false}
        />
      );
    case "float":
      return (
        <NumberFilterField
          filter={filter}
          onChange={onChange}
          min={Number.parseFloat(`${record.min}`)}
          max={Number.parseFloat(`${record.max}`)}
        />
      );
    case "date":
      return (
        <DateFilterField
          filter={filter}
          onChange={onChange}
          min={record.min.toString()}
          max={record.max.toString()}
        />
      );
    default:
      return <Text size="sm">Not Implemented</Text>;
  }
});
