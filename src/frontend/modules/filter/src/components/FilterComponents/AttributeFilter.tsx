import {
  type TypedAttribute,
  useEventAttributes,
  useObjectAttributes,
} from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import type { Control } from "react-hook-form";

import type {
  GroupedOCELFilter,
  NativeEventAttributeFilter,
  NativeObjectAttributeFilter,
} from "../../api/base";
import { useDatatable } from "../../hooks/useDatatable";
import { useFilterColumns } from "../../hooks/useFilterColumn";
import { AttributeInputField } from "../inputs/AttributeInputField";

type AttributeFilterProps = {
  ocelId: string;
  control: Control<GroupedOCELFilter>;
};

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

const AttributeFilter =
  (entityType: "objects" | "events") =>
  ({ ocelId, control }: AttributeFilterProps) => {
    const isEvent = entityType === "events";

    const { data: attributes, isLoading } = (
      isEvent ? useEventAttributes : useObjectAttributes
    )(ocelId);

    const { columns, records, tableProps } = useDatatable({
      data: attributes,
      columnNames: ["name", "entity_type"],
      defaultSorted: "name",
    });

    const { filterColumns } = useFilterColumns({
      control,
      path: isEvent ? "event_attribute" : "object_attribute",
      generateFilterId: ({ attribute, target_type }) =>
        getFilterKey(target_type, attribute),
      generateRecordId: ({ entity_type, name }) =>
        getFilterKey(entity_type, name),
      generateInitialFilter: (record: TypedAttribute) => ({
        attribute: record.name,
        type: isEvent
          ? ("event_attribute" as const)
          : ("object_attribute" as const),
        target_type: record.entity_type,
        ...getInitialFilter(record),
      }),
      FilterComponent: ({ control, path, record }) => {
        return (
          <AttributeInputField control={control} path={path} record={record} />
        );
      },
    });

    return (
      <DataTable
        columns={[...columns, ...filterColumns]}
        withTableBorder
        records={records}
        noRecordsText="No attributes to filter"
        minHeight={500}
        {...tableProps}
        fetching={isLoading}
      />
    );
  };

export const EventAttributeFilter = AttributeFilter("events");
export const ObjectAttributeFilter = AttributeFilter("objects");
