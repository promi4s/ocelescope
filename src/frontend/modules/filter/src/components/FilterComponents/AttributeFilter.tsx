import { ActionIcon, MultiSelect, Text } from "@mantine/core";
import {
  type TypedAttribute,
  useEventAttributes,
  useObjectAttributes,
} from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortStatus,
} from "mantine-datatable";
import { useMemo, useState } from "react";
import { type Control, useFieldArray } from "react-hook-form";

import type {
  GroupedOCELFilter,
  NativeEventAttributeFilter,
  NativeObjectAttributeFilter,
} from "../../api/base";
import { sortRecords } from "../../util/sort";
import { AttributeInputField } from "../inputs/AttributeInputField";

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

    const [sortStatus, setSortStatus] = useState<
      DataTableSortStatus<TypedAttribute>
    >({
      columnAccessor: "name",
      direction: "asc",
    });

    const [selectedEntityTypeNames, setSelectedEntityTypeNames] = useState<
      string[]
    >([]);

    const [selectedAttributeNames, setSelectedAttributeNames] = useState<
      string[]
    >([]);

    const sortedAttributes = useMemo(() => {
      return sortRecords(
        attributes ?? [],
        sortStatus.columnAccessor as keyof TypedAttribute,
        sortStatus.direction,
      ).filter(
        ({ name, entity_type }) =>
          (selectedEntityTypeNames.length === 0 ||
            selectedEntityTypeNames.includes(entity_type)) &&
          (selectedAttributeNames.length === 0 ||
            selectedAttributeNames.includes(name)),
      );
    }, [
      attributes,
      sortStatus,
      selectedEntityTypeNames,
      selectedAttributeNames,
    ]);

    const columns = useMemo(
      () =>
        [
          {
            accessor: "name",
            title: "Attribute Name",
            sortable: true,
            filter: () => (
              <MultiSelect
                data={Array.from(new Set(attributes?.map(({ name }) => name)))}
                value={selectedAttributeNames}
                onChange={(newAttributeNameSelection) =>
                  setSelectedAttributeNames(newAttributeNameSelection)
                }
                comboboxProps={{ withinPortal: false }}
                clearable
                searchable
              />
            ),
            filtering: selectedAttributeNames.length > 0,
          },
          {
            accessor: "entity_type",
            title: isEvent ? "Activity" : "Object Type",
            sortable: true,
            filter: () => (
              <MultiSelect
                data={Array.from(
                  new Set(attributes?.map(({ entity_type }) => entity_type)),
                )}
                value={selectedEntityTypeNames}
                onChange={(newEntityTypeNameSelection) =>
                  setSelectedEntityTypeNames(newEntityTypeNameSelection)
                }
                comboboxProps={{ withinPortal: false }}
                clearable
                searchable
              />
            ),
            filtering: selectedEntityTypeNames.length > 0,
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
        ] satisfies DataTableColumn<TypedAttribute>[],
      [
        append,
        control,
        fieldName,
        filterIndexMap,
        isEvent,
        remove,
        selectedEntityTypeNames,
        selectedAttributeNames,
        attributes,
      ],
    );

    return (
      <DataTable
        idAccessor={(record: TypedAttribute) =>
          `${record.entity_type}-${record.name}`
        }
        columns={columns}
        withTableBorder
        records={sortedAttributes}
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
      />
    );
  };

export const EventAttributeFilter = AttributeFilter("events");
export const ObjectAttributeFilter = AttributeFilter("objects");
