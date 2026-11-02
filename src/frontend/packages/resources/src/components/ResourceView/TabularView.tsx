import {
  ActionIcon,
  Autocomplete,
  Center,
  Group,
  LoadingOverlay,
  MultiSelect,
  Popover,
  Scroller,
  Tabs,
  Text,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import {
  type ResourceTable,
  useResourceTableColumnValues,
  useResourceTableRows,
  useResourceTables,
} from "@ocelescope/api-base";
import { SearchIcon } from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortStatus,
} from "mantine-datatable";
import { useMemo, useState } from "react";
import { formatCell } from "./Viewers/Table";

type Row = Record<string, unknown> & { rowKey: number };

const PAGE_SIZES = [20, 50, 100];
const UNSORTED = { columnAccessor: "", direction: "asc" } as const;

const VALUE_LIMIT = 50;

const ColumnFilter: React.FC<{
  resourceId: string;
  tableName: string;
  columnId: string;
  selected: string[];
  onChange: (values: string[]) => void;
}> = ({ resourceId, tableName, columnId, selected, onChange }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);

  const { data, isFetching } = useResourceTableColumnValues(
    resourceId,
    tableName,
    columnId,
    { size: VALUE_LIMIT, ...(debouncedSearch && { search: debouncedSearch }) },
    { query: { placeholderData: (previous) => previous } },
  );

  const options = useMemo(
    () => [...new Set([...selected, ...(data?.response ?? [])])],
    [selected, data?.response],
  );
  const total = data?.total_items ?? 0;

  return (
    <MultiSelect
      w={280}
      searchable
      clearable
      data={options}
      value={selected}
      onChange={onChange}
      searchValue={search}
      onSearchChange={setSearch}
      filter={({ options: unfiltered }) => unfiltered}
      placeholder={`Search ${columnId}`}
      nothingFoundMessage={isFetching ? "Loading..." : "No values found"}
      description={
        total > VALUE_LIMIT
          ? `Showing ${VALUE_LIMIT} of ${total} values, type to narrow down`
          : undefined
      }
      comboboxProps={{ withinPortal: false }}
    />
  );
};

const TableRows: React.FC<{ resourceId: string; table: ResourceTable }> = ({
  resourceId,
  table,
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0] as number);
  const [sortStatus, setSortStatus] =
    useState<DataTableSortStatus<Row>>(UNSORTED);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const hasFilters = Object.values(filters).some((values) => values.length > 0);

  const { data, isError, isFetching } = useResourceTableRows(
    resourceId,
    table.name,
    {
      page,
      size: pageSize,
      ...(sortStatus.columnAccessor && {
        sort_by: sortStatus.columnAccessor,
        descending: sortStatus.direction === "desc",
      }),
      ...(hasFilters && { filters: JSON.stringify(filters) }),
    },
    { query: { placeholderData: (previous) => previous } },
  );

  const columns: DataTableColumn<Row>[] = useMemo(
    () =>
      table.columns.map((column) => ({
        accessor: column.id,
        title: column.id,
        sortable: true,
        render: (row) => formatCell(row[column.id], column.data_type),
        filtering: (filters[column.id] ?? []).length > 0,
        filter: (
          <ColumnFilter
            resourceId={resourceId}
            tableName={table.name}
            columnId={column.id}
            selected={filters[column.id] ?? []}
            onChange={(values) => {
              setFilters((current) => ({ ...current, [column.id]: values }));
              setPage(1);
            }}
          />
        ),
      })),
    [resourceId, table.name, table.columns, filters],
  );

  const records: Row[] = useMemo(
    () =>
      (data?.response ?? []).map((row, index) => ({
        ...row,
        rowKey: (page - 1) * pageSize + index,
      })),
    [data?.response, page, pageSize],
  );

  if (isError) {
    return (
      <Center h="100%" p="md">
        <Text c="dimmed">Could not load the table</Text>
      </Center>
    );
  }

  return (
    <DataTable
      height="100%"
      idAccessor="rowKey"
      records={records}
      columns={columns}
      fetching={isFetching}
      withTableBorder
      withColumnBorders
      sortStatus={sortStatus}
      onSortStatusChange={(status) => {
        setSortStatus(status);
        setPage(1);
      }}
      totalRecords={data?.total_items ?? 0}
      recordsPerPage={pageSize}
      page={page}
      onPageChange={setPage}
      recordsPerPageOptions={PAGE_SIZES}
      onRecordsPerPageChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );
};

const TableTabs: React.FC<{
  resourceId: string;
  tables: ResourceTable[];
}> = ({ resourceId, tables }) => {
  const [activeTable, setActiveTable] = useState<string | null>(
    tables[0]?.name ?? null,
  );
  const [searchOpened, { toggle: toggleSearch, close: closeSearch }] =
    useDisclosure(false);

  return (
    <Tabs
      keepMounted={false}
      h="100%"
      style={{ display: "flex", flexDirection: "column" }}
      value={activeTable}
      onChange={setActiveTable}
    >
      {tables.length > 1 && (
        <Group wrap="nowrap" gap="0" style={{ flexShrink: 0 }}>
          <Popover
            width={300}
            position="bottom-start"
            withArrow
            shadow="md"
            opened={searchOpened}
            onChange={closeSearch}
            trapFocus
            returnFocus
          >
            <Popover.Target>
              <ActionIcon
                size="lg"
                h="100%"
                onClick={toggleSearch}
                aria-label="Search tables"
                bdrs={0}
              >
                <SearchIcon size={16} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Autocomplete
                data={tables.map(({ name }) => name)}
                aria-label="Table"
                placeholder="Search tables"
                selectFirstOptionOnChange
                comboboxProps={{ withinPortal: false }}
                onOptionSubmit={(name) => {
                  setActiveTable(name);
                  closeSearch();
                }}
              />
            </Popover.Dropdown>
          </Popover>
          <Tabs.List flex={1} miw={0}>
            <Scroller>
              {tables.map(({ name }) => (
                <Tabs.Tab key={name} value={name}>
                  {name}
                </Tabs.Tab>
              ))}
            </Scroller>
          </Tabs.List>
        </Group>
      )}
      {tables.map((table) => (
        <Tabs.Panel key={table.name} value={table.name} flex={1} mih={0}>
          <TableRows resourceId={resourceId} table={table} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};

export const TabularView: React.FC<{ resourceId: string }> = ({
  resourceId,
}) => {
  const { data: tables, isError, isPending } = useResourceTables(resourceId);

  if (isError) {
    return (
      <Center h="100%" p="md">
        <Text c="dimmed">Could not load the tables</Text>
      </Center>
    );
  }

  if (isPending) {
    return <LoadingOverlay visible />;
  }

  if (tables.length === 0) {
    return (
      <Center h="100%" p="md">
        <Text c="dimmed">This resource has no tables</Text>
      </Center>
    );
  }

  return <TableTabs resourceId={resourceId} tables={tables} />;
};
