import { ActionIcon, Group, NumberInput, Text, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import {
  type TypedAttribute,
  useEventAttributes,
  useObjectAttributes,
} from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import { DataTable } from "mantine-datatable";
import { memo, useMemo } from "react";
import { type Control, Controller, useFieldArray } from "react-hook-form";

import type {
  GroupedOCELFilter,
  NativeEventAttributeFilter,
  NativeObjectAttributeFilter,
} from "../../api/base";

type AttributeFilterProps = {
  ocelId: string;
  control: Control<GroupedOCELFilter>;
};

type FilterPath = "event_attribute" | "object_attribute";

type FilterRecord = Omit<
  NativeEventAttributeFilter | NativeObjectAttributeFilter,
  "target_type" | "type" | "attribute"
>;

const getFilterKey = (targetType: string, attribute: string) =>
  `${targetType}::${attribute}`;

const getInitialFilter = (attribute: TypedAttribute): FilterRecord => {
  switch (attribute.type) {
    case "string":
      return { regex: "" };

    case "int":
      return {
        number_range: [
          Number.parseInt(`${attribute.min}`, 10),
          Number.parseInt(`${attribute.max}`, 10),
        ],
      };

    case "float":
      return {
        number_range: [
          Number.parseFloat(`${attribute.min}`),
          Number.parseFloat(`${attribute.max}`),
        ],
      };

    case "date":
      return {
        time_range: [String(attribute.min), String(attribute.max)],
      };

    default:
      return {};
  }
};

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
  step,
  precision,
}: {
  control: Control<GroupedOCELFilter>;
  name: `${FilterPath}.${number}.number_range`;
  min: number;
  max: number;
  step?: number;
  precision?: number;
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
              style={{ flex: 1 }}
            />

            <Text c="dimmed" size="sm" pb={8}>
              -
            </Text>

            <NumberInput
              value={currentMax}
              min={currentMin ?? min}
              max={max}
              step={step}
              clampBehavior="strict"
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
  index,
  path,
  record,
}: {
  control: Control<GroupedOCELFilter>;
  index: number;
  path: FilterPath;
  record: TypedAttribute;
}) {
  const minDate = new Date(String(record.min));
  const maxDate = new Date(String(record.max));

  return (
    <Group grow align="end">
      <Controller
        control={control}
        name={`${path}.${index}.time_range.0`}
        render={({ field }) => (
          <DateTimePicker
            label="From"
            value={field.value ? new Date(field.value) : minDate}
            onChange={(value) =>
              field.onChange(value ? value.toISOString() : "")
            }
            minDate={minDate}
            maxDate={maxDate}
          />
        )}
      />

      <Controller
        control={control}
        name={`${path}.${index}.time_range.1`}
        render={({ field }) => (
          <DateTimePicker
            label="To"
            value={field.value ? new Date(field.value) : maxDate}
            onChange={(value) =>
              field.onChange(value ? value.toISOString() : "")
            }
            minDate={minDate}
            maxDate={maxDate}
          />
        )}
      />
    </Group>
  );
});

const AttributeInputField = memo(function AttributeInputField({
  control,
  record,
  index,
  path,
}: {
  control: Control<GroupedOCELFilter>;
  index: number;
  path: FilterPath;
  record: TypedAttribute;
}) {
  switch (record.type) {
    case "string":
      return (
        <StringFilterField control={control} name={`${path}.${index}.regex`} />
      );

    case "int":
      return (
        <NumberFilterField
          control={control}
          name={`${path}.${index}.number_range`}
          min={Number.parseInt(`${record.min}`, 10)}
          max={Number.parseInt(`${record.max}`, 10)}
        />
      );

    case "float": {
      const min = Number.parseFloat(`${record.min}`);
      const max = Number.parseFloat(`${record.max}`);
      const range = max - min;

      const step =
        range <= 0.001
          ? 0.000001
          : range <= 0.01
            ? 0.0001
            : range <= 1
              ? 0.001
              : 0.01;

      const precision =
        step === 0.000001 ? 6 : step === 0.0001 ? 4 : step === 0.001 ? 3 : 2;

      return (
        <NumberFilterField
          control={control}
          name={`${path}.${index}.number_range`}
          min={min}
          max={max}
          step={step}
          precision={precision}
        />
      );
    }

    case "date":
      return (
        <DateFilterField
          control={control}
          index={index}
          path={path}
          record={record}
        />
      );

    default:
      return <Text size="sm">Not Implemented</Text>;
  }
});

const AttributeFilter =
  (entityType: "objects" | "events") =>
  ({ ocelId, control }: AttributeFilterProps) => {
    const isEvent = entityType === "events";
    const fieldName: FilterPath = isEvent
      ? "event_attribute"
      : "object_attribute";

    const { fields, append, remove } = useFieldArray({
      name: fieldName,
      control,
    });

    const { data: attributes } = (
      isEvent ? useEventAttributes : useObjectAttributes
    )(ocelId);

    const filterIndexMap = useMemo(() => {
      const map = new Map<string, number>();

      fields.forEach((field, index) => {
        map.set(getFilterKey(field.target_type, field.attribute), index);
      });

      return map;
    }, [fields]);

    const records = attributes ?? [];

    const columns = useMemo(
      () => [
        { accessor: "name", title: "Attribute Name" },
        {
          accessor: "entity_type",
          title: isEvent ? "Activity" : "Object Type",
        },
        {
          accessor: "filter",
          render: (attribute: TypedAttribute) => {
            const filterIndex =
              filterIndexMap.get(
                getFilterKey(attribute.entity_type, attribute.name),
              ) ?? -1;

            if (filterIndex < 0) {
              return (
                <Text size="sm" c="dimmed">
                  No filter applied
                </Text>
              );
            }

            return (
              <AttributeInputField
                record={attribute}
                control={control}
                index={filterIndex}
                path={fieldName}
              />
            );
          },
        },
        {
          accessor: "action",
          title: "",
          width: 60,
          render: (record: TypedAttribute) => {
            const key = getFilterKey(record.entity_type, record.name);
            const filterIndex = filterIndexMap.get(key) ?? -1;

            if (filterIndex < 0) {
              return (
                <ActionIcon
                  color="green"
                  variant="light"
                  onClick={() =>
                    append({
                      attribute: record.name,
                      target_type: record.entity_type,
                      type: isEvent ? "event_attribute" : "object_attribute",
                      ...getInitialFilter(record),
                    })
                  }
                >
                  <PlusIcon size={16} />
                </ActionIcon>
              );
            }

            return (
              <ActionIcon
                color="red"
                variant="light"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(filterIndex);
                }}
              >
                <XIcon size={16} />
              </ActionIcon>
            );
          },
        },
      ],
      [append, control, fieldName, filterIndexMap, isEvent, remove],
    );

    return (
      <DataTable
        idAccessor={(record: TypedAttribute) =>
          `${record.entity_type}-${record.name}`
        }
        columns={columns}
        records={records}
      />
    );
  };

export const EventAttributeFilter = AttributeFilter("events");
export const ObjectAttributeFilter = AttributeFilter("objects");
