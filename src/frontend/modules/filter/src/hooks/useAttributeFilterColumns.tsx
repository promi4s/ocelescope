import { ActionIcon, Switch, Text } from "@mantine/core";
import type { AggregatedAttribute, TypedAttribute } from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import type { DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import { type Control, useFieldArray } from "react-hook-form";
import type { EventAttributeFilter, ObjectAttributeFilter } from "../api/base";
import { AttributeInputField } from "../components/inputs/AttributeInputField";
import type { GroupedFilter } from "../types/filter";

type FilterRecord = Omit<
  EventAttributeFilter | ObjectAttributeFilter,
  "target_type" | "type" | "attribute"
>;

type AttributeUnion = AggregatedAttribute | TypedAttribute;

const getInitialFilter = (
  attribute: Omit<TypedAttribute, "name" | "entity_type">,
): FilterRecord => {
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

const getEntityType = (attribute: AttributeUnion): string | undefined => {
  if (!("entity_type_names" in attribute)) {
    return attribute.entity_type;
  }
  return attribute.entity_type_names.length === 1
    ? attribute.entity_type_names[0]
    : undefined;
};

const generateRecordId = (attribute: AttributeUnion) => {
  const entityName = getEntityType(attribute);

  return `${attribute.name}::${entityName ?? ""}`;
};

type UseFilterColumnsProps = {
  control: Control<GroupedFilter>;
  path: "event_attribute" | "object_attribute";
};

export const useAttributeFilter = ({
  path,
  control,
}: UseFilterColumnsProps) => {
  const { fields, append, remove } = useFieldArray<
    GroupedFilter,
    "event_attribute" | "object_attribute"
  >({
    name: path,
    control,
  });

  const filterIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    fields.forEach(({ attribute, target_type }, index) => {
      map.set(`${attribute}::${target_type ?? ""}`, index);
    });

    return map;
  }, [fields]);

  const [showOnlyFiltered, setShowOnlyFiltered] = useState(false);

  const filteredAttributeNames = useMemo(
    () => Array.from(new Set(fields.map(({ attribute }) => attribute))),
    [fields],
  );

  const filterColumns = useMemo<DataTableColumn<AttributeUnion>[]>(
    () => [
      {
        accessor: "filter",
        title: "Filter",
        filter: () => (
          <Switch
            label="Show only filtered attributes"
            checked={showOnlyFiltered}
            onChange={(event) =>
              setShowOnlyFiltered(event.currentTarget.checked)
            }
          />
        ),
        filtering: showOnlyFiltered,
        render: (record) => {
          const filterIndex =
            filterIndexMap.get(generateRecordId(record)) ?? -1;

          return filterIndex < 0 ? (
            <Text size="sm" c="dimmed">
              {record.min} - {record.max}
            </Text>
          ) : (
            <AttributeInputField
              record={record}
              control={control}
              path={`${path}.${filterIndex}`}
            />
          );
        },
      },
      {
        accessor: "action",
        title: "",
        width: "50px",
        render: (record) => {
          const key = generateRecordId(record);
          const filterIndex = filterIndexMap.get(key) ?? -1;

          return filterIndex < 0 ? (
            <ActionIcon
              color="green"
              variant="light"
              onClick={(event) => {
                event.stopPropagation();
                append({
                  attribute: record.name,
                  type: path,
                  target_type: getEntityType(record),
                  ...getInitialFilter(record),
                });
              }}
            >
              <PlusIcon size={16} />
            </ActionIcon>
          ) : (
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
    [append, remove, filterIndexMap, path, control, showOnlyFiltered],
  );

  return {
    filterColumns,
    visibleAttributes: showOnlyFiltered ? filteredAttributeNames : undefined,
  };
};
