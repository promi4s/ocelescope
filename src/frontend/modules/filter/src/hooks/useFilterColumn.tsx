import { ActionIcon, Text } from "@mantine/core";
import { PlusIcon, XIcon } from "lucide-react";
import type { DataTableColumn } from "mantine-datatable";
import { useMemo } from "react";
import {
  type Control,
  type FieldArray,
  type FieldArrayPath,
  useFieldArray,
} from "react-hook-form";
import type { GroupedOCELFilter } from "../api/base";

type FilterElement<K extends FieldArrayPath<GroupedOCELFilter>> = FieldArray<
  GroupedOCELFilter,
  K
>;

type UseFilterColumnsProps<
  T extends Record<string, any>,
  K extends FieldArrayPath<GroupedOCELFilter>,
> = {
  control: Control<GroupedOCELFilter>;
  path: K;
  generateRecordId: (record: T) => string;
  generateFilterId: (filter: FilterElement<K>) => string;
  generateInitialFilter: (record: T) => FilterElement<K>;
};

export const useFilterColumns = <
  T extends Record<string, any>,
  K extends FieldArrayPath<GroupedOCELFilter>,
>({
  path,
  control,
  generateRecordId,
  generateFilterId,
  generateInitialFilter,
}: UseFilterColumnsProps<T, K>) => {
  const { fields, append, remove } = useFieldArray<GroupedOCELFilter, K>({
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
            <></>
          );
        },
      },
      {
        accessor: "action",
        title: "",
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
    [append, remove, filterIndexMap, generateRecordId, generateInitialFilter],
  );

  return { filterColumn: filterColumns };
};
