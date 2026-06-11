import { MultiSelect } from "@mantine/core";
import type { DataTableColumn, DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortRecords } from "../util/sort";

type useDatatableProps<T extends Record<string, any>> = {
  data?: T[];
  columnNames: (keyof T)[];
  defaultSorted: keyof T;
  pageSize?: number;
};

export const useDatatable = <T extends Record<string, any>>({
  data = [],
  columnNames,
  defaultSorted,
  pageSize = 20,
}: useDatatableProps<T>) => {
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<T>>({
    columnAccessor: defaultSorted,
    direction: "asc",
  });

  const [columnSelection, setColumnSelection] = useState<
    Partial<Record<keyof T, string[]>>
  >({});

  const [page, setPage] = useState<number>(0);

  const records = useMemo(() => {
    return sortRecords(
      data,
      sortStatus.columnAccessor as keyof T,
      sortStatus.direction,
    )
      .filter((record) =>
        Object.entries(columnSelection).every(
          ([a, b]) => !b || b.length === 0 || b.includes(record[a]),
        ),
      )
      .slice(
        page * Math.floor(data.length / pageSize),
        (page + 1) * Math.floor(data.length / pageSize),
      );
  }, [sortStatus, columnSelection, data]);

  const columns = useMemo(
    () =>
      columnNames.map((columnName) => ({
        accessor: columnName,
        sortable: true,
        filter: () => (
          <MultiSelect
            data={Array.from(new Set(data.map((record) => record[columnName])))}
            value={columnSelection[columnName]}
            onChange={(newColumnSelection) =>
              setColumnSelection({
                ...columnSelection,
                ...{ [columnName]: newColumnSelection },
              })
            }
            comboboxProps={{ withinPortal: false }}
            clearable
            searchable
          />
        ),
        filtering:
          columnSelection[columnName] && columnSelection[columnName].length > 0,
      })) satisfies DataTableColumn<T>[],

    [data, columnNames],
  );

  return { records, columns, sortStatus, setSortStatus };
};
