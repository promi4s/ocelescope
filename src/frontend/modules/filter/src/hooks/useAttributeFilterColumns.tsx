import { Button, Switch, Text } from "@mantine/core";
import type { AggregatedAttribute, TypedAttribute } from "@ocelescope/api-base";
import { CheckIcon } from "lucide-react";
import type { DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import { AttributeInputField } from "../components/inputs/AttributeInputField";
import type { FilterOf } from "../types/filter";

type AttributeFilter = FilterOf<"event_attribute" | "object_attribute">;

type Condition = Omit<AttributeFilter, "target_type" | "type" | "attribute">;

type AttributeUnion = AggregatedAttribute | TypedAttribute;

const getInitialCondition = (
  attribute: Omit<TypedAttribute, "name" | "entity_type">,
): Condition => {
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

const recordId = (attribute: string, entityType?: string | null) =>
  `${attribute}::${entityType ?? ""}`;

type UseAttributeFilterProps = {
  filter: AttributeFilter;
  onChange: (filter: AttributeFilter) => void;
};

export const useAttributeFilter = ({
  filter,
  onChange,
}: UseAttributeFilterProps) => {
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const selectedId = filter.attribute
    ? recordId(filter.attribute, filter.target_type)
    : undefined;

  const filterColumns = useMemo<DataTableColumn<AttributeUnion>[]>(
    () => [
      {
        accessor: "filter",
        title: "Condition",
        filter: () => (
          <Switch
            label="Show only the selected attribute"
            checked={showOnlySelected}
            onChange={(event) =>
              setShowOnlySelected(event.currentTarget.checked)
            }
          />
        ),
        filtering: showOnlySelected,
        render: (record) =>
          recordId(record.name, getEntityType(record)) === selectedId ? (
            <AttributeInputField
              record={record}
              filter={filter}
              onChange={onChange}
            />
          ) : (
            <Text size="sm" c="dimmed">
              {record.min} - {record.max}
            </Text>
          ),
      },
      {
        accessor: "action",
        title: "",
        width: "90px",
        render: (record) =>
          recordId(record.name, getEntityType(record)) === selectedId ? (
            <Button
              size="compact-sm"
              variant="light"
              color="green"
              leftSection={<CheckIcon size={14} />}
            >
              Used
            </Button>
          ) : (
            <Button
              size="compact-sm"
              variant="default"
              onClick={(event) => {
                event.stopPropagation();
                onChange({
                  type: filter.type,
                  attribute: record.name,
                  target_type: getEntityType(record),
                  ...getInitialCondition(record),
                } as AttributeFilter);
              }}
            >
              Use
            </Button>
          ),
      },
    ],
    [filter, onChange, selectedId, showOnlySelected],
  );

  return {
    filterColumns,
    visibleAttributes:
      showOnlySelected && filter.attribute ? [filter.attribute] : undefined,
  };
};
