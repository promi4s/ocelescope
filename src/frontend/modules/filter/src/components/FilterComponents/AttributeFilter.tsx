import { ActionIcon, RangeSlider, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import {
  type TypedAttribute,
  useEventAttributes,
  useObjectAttributes,
} from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import { DataTable } from "mantine-datatable";
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

const getInitalFilter: (
  attribute: TypedAttribute,
) => Omit<
  NativeEventAttributeFilter | NativeObjectAttributeFilter,
  "target_type" | "type" | "attribute"
> = (attribute: TypedAttribute) => {
  switch (attribute.type) {
    case "string":
      return { regex: "" };
    case "int":
      return {
        number_range: [
          Number.parseInt(`${attribute.min}`),
          Number.parseInt(`${attribute.max}`),
        ],
      };
    case "float":
      return {
        number_range: [
          Number.parseInt(`${attribute.min}`),
          Number.parseInt(`${attribute.max}`),
        ],
      };
    case "date":
      return {
        time_range: [
          `${attribute.min.toString()}`,
          `${attribute.max.toString()}`,
        ],
      };
    default:
      return {};
  }
};

const AttributeInputField = ({
  control,
  record,
  index,
  path,
}: {
  control: Control<GroupedOCELFilter>;
  index: number;
  path: "event_attribute" | "object_attribute";
  record: TypedAttribute;
}) => {
  switch (record.type) {
    case "string":
      return (
        <Controller
          name={`${path}.${index}.regex`}
          control={control}
          render={({ field }) => (
            <TextInput
              value={field.value ?? undefined}
              onChange={field.onChange}
            />
          )}
        />
      );
    case "int":
      return (
        <Controller
          name={`${path}.${index}.number_range`}
          control={control}
          render={({ field }) => (
            <RangeSlider
              value={[field.value?.[0] ?? 0, field.value?.[1] ?? 0]}
              min={Number.parseInt(`${record.min}`, 10)}
              max={Number.parseInt(`${record.max}`, 10)}
              minRange={1}
              onChange={field.onChange}
            />
          )}
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
        <Controller
          name={`${path}.${index}.number_range`}
          control={control}
          render={({ field }) => (
            <RangeSlider
              value={[field.value?.[0] ?? min, field.value?.[1] ?? max]}
              min={min}
              max={max}
              step={step}
              minRange={step}
              precision={precision}
              label={(value) => value.toFixed(precision)}
              onChange={field.onChange}
            />
          )}
        />
      );
    }
    case "date":
      return (
        <Controller
          control={control}
          name={`${path}.${index}.time_range`}
          render={({ field: { onChange, value } }) => {
            const min = record.min.toString();
            const max = record.max.toString();

            return (
              <DateTimePicker
                label={"Date Range"}
                value={[value?.[0] ?? min, value?.[1] ?? max]}
                onChange={onChange}
                minDate={min}
                maxDate={max}
              />
            );
          }}
        />
      );
    default:
      return <>Not Implemented</>;
  }
};

const AttributeFilter =
  (entityType: "objects" | "events") =>
  ({ ocelId, control }: AttributeFilterProps) => {
    const isEvent = entityType === "events";
    const fieldName = isEvent ? "event_attribute" : "object_attribute";

    const { fields, append, remove } = useFieldArray({
      name: fieldName,
      control,
    });

    const { data: attributes } = (
      isEvent ? useEventAttributes : useObjectAttributes
    )(ocelId);

    return (
      <DataTable
        idAccessor={(record) => `${record.entity_type}-${record.name}`}
        columns={[
          { accessor: "name", title: "AttributeName" },
          {
            accessor: "entity_type",
            title: isEvent ? "Activity" : "Object Type",
          },
          {
            accessor: "filter",
            render: (attribute) => {
              const filterIndex = fields.findIndex(
                (f) =>
                  f.attribute === attribute.name &&
                  f.target_type === attribute.entity_type,
              );
              return filterIndex < 0 ? (
                "No Filter Applied"
              ) : (
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
            render: (record) => {
              const filterIndex = fields.findIndex(
                (f) =>
                  f.attribute === record.name &&
                  f.target_type === record.entity_type,
              );

              return filterIndex < 0 ? (
                <ActionIcon
                  color="green"
                  onClick={() =>
                    append({
                      attribute: record.name,
                      target_type: record.entity_type,
                      type: isEvent ? "event_attribute" : "object_attribute",
                      ...getInitalFilter(record),
                    })
                  }
                >
                  <PlusIcon />
                </ActionIcon>
              ) : (
                <ActionIcon
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(filterIndex);
                  }}
                  color="red"
                >
                  <XIcon />
                </ActionIcon>
              );
            },
          },
        ]}
        records={attributes ?? []}
      />
    );
  };

export const EventAttributeFilter = AttributeFilter("events");
export const ObjectAttributeFilter = AttributeFilter("objects");
