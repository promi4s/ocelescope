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

const DEFAULT_PAGE_SIZE = 15;

export const useDatatable = <T extends Record<string, any>>({
  data = [],
  columnNames,
  defaultSorted,
  pageSize = DEFAULT_PAGE_SIZE,
}: useDatatableProps<T>) => {
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<T>>({
    columnAccessor: defaultSorted,
    direction: "asc",
  });

  const [columnSelection, setColumnSelection] = useState<
    Partial<Record<keyof T, string[]>>
  >({});

  const [page, setPage] = useState(1);

  const { records, totalRecords } = useMemo(() => {
    const filteredRecords = sortRecords(
      data,
      sortStatus.columnAccessor as keyof T,
      sortStatus.direction,
    ).filter((record) =>
      Object.entries(columnSelection).every(
        ([a, b]) => !b || b.length === 0 || b.includes(record[a]),
      ),
    );

    return {
      records: filteredRecords.slice((page - 1) * pageSize, page * pageSize),
      totalRecords: filteredRecords.length,
    };
  }, [sortStatus, columnSelection, data, page, pageSize]);

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

  return {
    records,
    columns,
    sortStatus,
    setSortStatus,
    page,
    pageSize,
    setPage,
    tableProps: {
      sortStatus: sortStatus,
      onSortStatusChange: setSortStatus,
      totalRecords,
      page: page,
      recordsPerPage: pageSize,
      onPageChange: setPage,
    },
  };
};
