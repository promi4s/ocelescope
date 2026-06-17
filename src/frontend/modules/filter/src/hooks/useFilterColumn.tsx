import { ActionIcon, Checkbox, Text } from "@mantine/core";
import { PlusIcon, XIcon } from "lucide-react";
import type { DataTableColumn } from "mantine-datatable";
import { type ComponentType, useCallback, useMemo, useState } from "react";
import {
  type Control,
  type FieldArray,
  type FieldArrayPath,
  useFieldArray,
} from "react-hook-form";
import type { GroupedFilter } from "../types/filter";

type FilterElement<K extends FieldArrayPath<GroupedFilter>> = FieldArray<
  GroupedFilter,
  K
>;

type UseFilterColumnsProps<
  T extends Record<string, any>,
  K extends FieldArrayPath<GroupedFilter>,
> = {
  control: Control<GroupedFilter>;
  path: K;
  generateRecordId: (record: T) => string;
  generateFilterId: (filter: FilterElement<K>) => string;
  generateInitialFilter: (record: T) => FilterElement<K>;
  FilterComponent: ComponentType<{
    control: Control<GroupedFilter>;
    path: `${K}.${number}`;
    record: T;
  }>;
};

export const useFilterColumns = <
  T extends Record<string, any>,
  K extends FieldArrayPath<GroupedFilter>,
>({
  path,
  control,
  generateRecordId,
  generateFilterId,
  generateInitialFilter,
  FilterComponent,
}: UseFilterColumnsProps<T, K>) => {
  const { fields, append, remove } = useFieldArray<GroupedFilter, K>({
    name: path,
    control,
  });

  const filterIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    fields.forEach((field, index) => {
      map.set(generateFilterId(field as FilterElement<K>), index);
    });

    return map;
  }, [fields, generateFilterId]);

  const [showOnlyFilteredRows, setShowOnlyFilteredRows] = useState(false);

  const filterColumns = useMemo<DataTableColumn<T>[]>(
    () => [
      {
        accessor: "filter",
        title: "Filter",
        render: (record) => {
          const filterIndex =
            filterIndexMap.get(generateRecordId(record)) ?? -1;

          return filterIndex < 0 ? (
            <Text size="sm" c="dimmed">
              No filter applied
            </Text>
          ) : (
            <FilterComponent
              record={record}
              control={control}
              path={`${path}.${filterIndex}`}
            />
          );
        },
        filter: () => {
          return (
            <Checkbox
              label="Only show rows with filters"
              checked={showOnlyFilteredRows}
              onChange={(event) =>
                setShowOnlyFilteredRows(event.currentTarget.checked)
              }
            />
          );
        },
        filtering: showOnlyFilteredRows,
      },
      {
        accessor: "action",
        title: "",
        width: "50px",
        render: (record: T) => {
          const key = generateRecordId(record);
          const filterIndex = filterIndexMap.get(key) ?? -1;

          return filterIndex < 0 ? (
            <ActionIcon
              color="green"
              variant="light"
              onClick={() => append(generateInitialFilter(record))}
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
    [
      append,
      remove,
      filterIndexMap,
      generateRecordId,
      generateInitialFilter,
      showOnlyFilteredRows,
    ],
  );

  const recordFilter = useCallback(
    (record: T) =>
      fields.some((a) => generateRecordId(record) === generateFilterId(a)),
    [fields],
  );

  return {
    filterColumns,
    recordFilter: showOnlyFilteredRows ? recordFilter : undefined,
  };
};
