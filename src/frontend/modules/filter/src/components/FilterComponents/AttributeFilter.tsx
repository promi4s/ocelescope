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
          allowDecimals={false}
        />
      );
    case "float": {
      return (
        <NumberFilterField
          control={control}
          name={`${path}.${index}.number_range`}
          min={Number.parseFloat(`${record.min}`)}
          max={Number.parseFloat(`${record.max}`)}
        />
      );
    }
    case "date":
      return (
        <DateFilterField
          control={control}
          name={`${path}.${index}.time_range`}
          min={record.min.toString()}
          max={record.max.toString()}
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
