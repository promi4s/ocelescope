import { Group, NumberInput, Text, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { TypedAttribute } from "@ocelescope/api-base";

import { memo } from "react";
import { type Control, Controller } from "react-hook-form";

import type { GroupedOCELFilter } from "../../api/base";

type FilterPath = "event_attribute" | "object_attribute";

const StringFilterField = memo(function StringFilterField({
  control,
  name,
}: {
  control: Control<GroupedOCELFilter>;
  name: `${FilterPath}.${number}.regex`;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextInput
          value={field.value ?? ""}
          onChange={field.onChange}
          placeholder="Enter regex"
        />
      )}
    />
  );
});

const NumberFilterField = memo(function NumberFilterField({
  control,
  name,
  min,
  max,
  allowDecimals,
}: {
  control: Control<GroupedOCELFilter>;
  name: `${FilterPath}.${number}.number_range`;
  min: number;
  max: number;
  allowDecimals?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const currentMin =
          typeof field.value?.[0] === "number" ? field.value[0] : undefined;
        const currentMax =
          typeof field.value?.[1] === "number" ? field.value[1] : undefined;

        return (
          <Group wrap="nowrap" align="end" gap="xs">
            <NumberInput
              value={currentMin}
              min={min}
              max={currentMax ?? max}
              clampBehavior="strict"
              onChange={(nextMin) => {
                field.onChange([nextMin, currentMax]);
              }}
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
              clampBehavior="strict"
              allowDecimal={allowDecimals}
              onChange={(nextMax) => {
                field.onChange([currentMin, nextMax]);
              }}
              style={{ flex: 1 }}
            />
          </Group>
        );
      }}
    />
  );
});

const DateFilterField = memo(function DateFilterField({
  control,
  name,
  min,
  max,
}: {
  control: Control<GroupedOCELFilter>;
  name: `${FilterPath}.${number}.time_range`;
  min: string;
  max: string;
  allowDecimals?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        return (
          <Group wrap="nowrap" align="end" gap="xs">
            <DateTimePicker
              value={field.value?.[0] ?? undefined}
              minDate={min}
              maxDate={field.value?.[1] ?? max}
              withSeconds
              onChange={(nextMin) => {
                field.onChange([nextMin, field.value?.[1] ?? max]);
              }}
              style={{ flex: 1 }}
            />

            <Text c="dimmed" size="sm" pb={8}>
              -
            </Text>

            <DateTimePicker
              value={field.value?.[1] ?? undefined}
              minDate={field.value?.[0] ?? min}
              maxDate={max}
              withSeconds
              onChange={(nextMax) => {
                field.onChange([field.value?.[0] ?? min, nextMax]);
              }}
              style={{ flex: 1 }}
            />
          </Group>
        );
      }}
    />
  );
});

export const AttributeInputField = memo(function AttributeInputField({
  control,
  record,
  path,
}: {
  control: Control<GroupedOCELFilter>;
  path: `${FilterPath}.${number}`;
  record: TypedAttribute;
}) {
  switch (record.type) {
    case "string":
      return <StringFilterField control={control} name={`${path}.regex`} />;
    case "int":
      return (
        <NumberFilterField
          control={control}
          name={`${path}.number_range`}
          min={Number.parseInt(`${record.min}`, 10)}
          max={Number.parseInt(`${record.max}`, 10)}
          allowDecimals={false}
        />
      );
    case "float": {
      return (
        <NumberFilterField
          control={control}
          name={`${path}.number_range`}
          min={Number.parseFloat(`${record.min}`)}
          max={Number.parseFloat(`${record.max}`)}
        />
      );
    }
    case "date":
      return (
        <DateFilterField
          control={control}
          name={`${path}.time_range`}
          min={record.min.toString()}
          max={record.max.toString()}
        />
      );

    default:
      return <Text size="sm">Not Implemented</Text>;
  }
});
