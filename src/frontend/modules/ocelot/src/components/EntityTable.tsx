import {
  DataTable,
  type DataTableColumn,
  type DataTableSortStatus,
} from "mantine-datatable";
import { useMemo } from "react";
import type { EntityTableColumn, PaginatedResponse } from "../api/base";

const EntityTable: React.FC<{
  entities: PaginatedResponse;
  columns: EntityTableColumn[];
  withTimestamp?: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  sortStatus?: DataTableSortStatus;
  onStartStatusChange: (sortStatus: DataTableSortStatus) => void;
}> = ({
  entities,
  columns,
  onPageChange,
  onPageSizeChange,
  sortStatus,
  onStartStatusChange,
}) => {
  const records = useMemo(
    () =>
      entities.items.map((entity) => ({
        ...entity,
        ...entity.attributes,
        ...Object.assign(
          {},
          ...Object.entries(entity.relations).map(
            ([qualifierName, entityIds]) => ({
              [qualifierName]: entityIds.join(", "),
            }),
          ),
        ),
      })),
    [entities],
  );

  const transformedColumns: DataTableColumn[] = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        sortable: column.type === "attribute",
      })),
    [columns],
  );

  return (
    <DataTable
      page={entities.page}
      totalRecords={entities.total_items}
      recordsPerPage={entities.page_size}
      onPageChange={onPageChange}
      withColumnBorders
      columns={transformedColumns}
      records={records}
      recordsPerPageOptions={[20, 40, 50]}
      onRecordsPerPageChange={onPageSizeChange}
      sortStatus={sortStatus ?? { columnAccessor: "id", direction: "asc" }}
      onSortStatusChange={onStartStatusChange}
    />
  );
};

export default EntityTable;
