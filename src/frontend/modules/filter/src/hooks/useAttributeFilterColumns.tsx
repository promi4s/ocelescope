import { Button } from "@mantine/core";
import type { AggregatedAttribute, TypedAttribute } from "@ocelescope/api-base";
import type { DataTableColumn } from "mantine-datatable";
import { useMemo } from "react";
import type { FilterOf } from "../types/filter";

type AttributeFilter = FilterOf<"event_attribute" | "object_attribute">;

type Condition = Omit<AttributeFilter, "target_type" | "type" | "attribute">;

type AttributeUnion = AggregatedAttribute | TypedAttribute;

const getInitialCondition = (
  attribute: Omit<TypedAttribute, "name" | "entity_type">,
): Condition => {
  switch (attribute.type) {
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

type UseAttributeFilterProps = {
  filter: AttributeFilter;
  onChange: (filter: AttributeFilter) => void;
};

export const useAttributeFilter = ({
  filter,
  onChange,
}: UseAttributeFilterProps) => {
  const filterColumns = useMemo<DataTableColumn<AttributeUnion>[]>(
    () => [
      {
        accessor: "action",
        title: "",
        width: "100px",
        render: (record) => (
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
    [filter.type, onChange],
  );

  return { filterColumns };
};
