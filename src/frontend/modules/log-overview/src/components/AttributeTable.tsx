import {
  type AggregatedAttribute,
  useAggregatedAttributes,
} from "@ocelescope/api-base";

import { keepPreviousData } from "@tanstack/react-query";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import { formatAttributeValue } from "../util/attributes";

const AttributesTable: React.FC<{
  ocelId: string;
  entityType?: "events" | "objects";
}> = ({ ocelId, entityType = "objects" }) => {
  const isEvent = entityType === "events";

  const [currentPage, setCurrentPage] = useState(1);

  const { data, isFetching } = useAggregatedAttributes(
    ocelId,
    {
      entity_type: entityType,
      page: currentPage,
      page_size: 10,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const columns: DataTableColumn<AggregatedAttribute>[] = useMemo(
    () =>
      [
        {
          accessor: "selector",
          title: "",
        },
        {
          accessor: "name",
          title: "Attribute Name",
        },
        {
          accessor: "entityTypeField",
          title: isEvent ? "Activity" : "Object Type",
          render: ({ entity_type_names }) =>
            `${entity_type_names.slice(0, 3).join(", ")}${entity_type_names.length > 3 ? `... (${entity_type_names.length} total)` : ""}`,
        },
        { accessor: "type", title: "Attribute Type" },
        {
          accessor: "range",
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
        },
        { accessor: "distinct_values", title: "Values" },
      ] satisfies DataTableColumn<AggregatedAttribute>[],
    [data],
  );

  return (
    <DataTable
      records={data?.response}
      columns={columns}
      withTableBorder
      height={500}
      fetching={isFetching}
      totalRecords={data?.total_items ?? 1}
      page={data?.page ?? 1}
      recordsPerPage={data?.page_size ?? 1}
      onPageChange={(page) => setCurrentPage(page)}
    />
  );
};

export default AttributesTable;
