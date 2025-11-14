import {
  EventAttributes200Item,
  ObjectAttributes200Item,
  PaginatedResponse,
  RelationCountSummary,
} from "@/api/fastapi-schemas";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useMemo } from "react";
const EntityTable: React.FC<{
  entities: PaginatedResponse;
  attributes?: (EventAttributes200Item | ObjectAttributes200Item)[];
  relations?: RelationCountSummary[];
  withTimestamp?: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  sortStatus?: DataTableSortStatus;
  onStartStatusChange: (sortStatus: DataTableSortStatus) => void;
}> = ({
  entities,
  withTimestamp,
  attributes = [],
  relations = [],
  onPageChange,
  onPageSizeChange,
  sortStatus,
  onStartStatusChange,
}) => {
  const columns = useMemo(
    () => [
      {
        accessor: "id",
        title: "#",
        sortable: true,
      },
      ...(withTimestamp
        ? [{ accessor: "timestamp", title: "date", sortable: true }]
        : []),
      ...attributes.map(({ attribute }) => ({
        accessor: attribute,
        sortable: true,
      })),
      ...relations.map(({ qualifier, target }) => ({
        accessor: `${qualifier}::${target}`,
        title: `${qualifier} (${target})`,
      })),
    ],
    [withTimestamp, attributes],
  );

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

  return (
    <DataTable
      page={entities.page}
      totalRecords={entities.total_items}
      recordsPerPage={entities.page_size}
      onPageChange={onPageChange}
      withColumnBorders
      columns={columns}
      records={records}
      recordsPerPageOptions={[20, 40, 50]}
      onRecordsPerPageChange={onPageSizeChange}
      sortStatus={sortStatus ?? { columnAccessor: "id", direction: "asc" }}
      onSortStatusChange={onStartStatusChange}
    />
  );
};

export default EntityTable;
