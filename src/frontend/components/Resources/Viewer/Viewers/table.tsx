import { VisualizationByType } from "@/types/resources";

import React, { useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { Group, ThemeIcon } from "@mantine/core";
import { Table2 } from "lucide-react";
import dayjs from "dayjs";
import { formatDate, formatDateTime } from "@/util/formatters";

type Table = VisualizationByType<"table">;
const formatCell = (
  value: any,
  dataType?: "string" | "number" | "boolean" | "date" | "datetime",
) => {
  if (value == null) return "";

  switch (dataType) {
    case "boolean":
      return value ? "✅" : "❌";

    case "date":
      return dayjs(value).isValid() ? formatDate(value) : String(value);

    case "datetime":
      return dayjs(value).isValid() ? formatDateTime(value) : String(value);

    default:
      return String(value);
  }
};
const PAGE_SIZES = [20, 50, 75];
// ---------- Component ----------
const TableView: React.FC<{ visualization: Table; isPreview?: boolean }> = ({
  visualization,
  isPreview,
}) => {
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  //TODO: Make everthing sortable and searchable
  const columns: DataTableColumn[] = useMemo(
    () =>
      visualization.columns.map((col) => ({
        accessor: col.id,
        title: col.label ?? col.id,
        render: (record) => formatCell(record[col.id], col.data_type),
      })),
    [visualization.columns],
  );
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState(visualization.rows.slice(0, pageSize));

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    setRecords(visualization.rows.slice(from, to));
  }, [page, pageSize]);

  const paginationProps =
    visualization.rows.length > PAGE_SIZES[0]
      ? {
          totalRecords: visualization.rows.length,
          recordsPerPage: pageSize,
          onPageChange: (p: number) => setPage(p),
          page,
          recordsPerPageOptions: PAGE_SIZES,
          onRecordsPerPageChange: setPageSize,
        }
      : {};

  if (isPreview) {
    return (
      <Group justify="center" align="center" p={"md"} w={"100%"} h={"100%"}>
        <ThemeIcon variant="transparent" size={"xl"}>
          <Table2 width={"100%"} height={"100%"} />
        </ThemeIcon>
      </Group>
    );
  }

  return (
    <DataTable
      records={records}
      columns={columns}
      withColumnBorders
      withRowBorders
      {...paginationProps}
    />
  );
};

export default TableView;
