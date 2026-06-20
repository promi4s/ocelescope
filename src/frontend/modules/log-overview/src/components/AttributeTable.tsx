import { MultiSelect, ThemeIcon } from "@mantine/core";
import {
  type AggregatedAttribute,
  type TypedAttribute,
  useActivities,
  useAggregatedAttributes,
  useAttributeNames,
  useEventAttributes,
  useObjectAttributes,
  useObjectTypes,
} from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import { formatAttributeValue } from "../util/attributes";

const PAGE_SIZE = 10;

const COLUMN_WIDTHS = {
  selector: 30,
  name: 200,
  entityType: 200,
  type: 100,
  range: 200,
  distinctValues: 120,
};

const SubAttributeTable: React.FC<{
  ocelId: string;
  attributeName: string;
  entityType?: "events" | "objects";
  entityNames?: string[];
  hideRange?: boolean;
  hideValues?: boolean;
  extraColumns?: DataTableColumn<TypedAttribute>[];
}> = ({
  ocelId,
  entityType = "objects",
  attributeName,
  entityNames,
  extraColumns = [],
}) => {
  const isEvent = entityType === "events";

  const { data, isFetching } = (
    isEvent ? useEventAttributes : useObjectAttributes
  )(
    ocelId,
    {
      attribute_names: [attributeName],
      names: entityNames,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const columns: DataTableColumn<TypedAttribute>[] = useMemo(
    () =>
      [
        {
          accessor: "selector",
          title: "",
          width: COLUMN_WIDTHS.selector,
        },
        {
          accessor: "",
          title: "Attribute Name",
          width: COLUMN_WIDTHS.name,
        },
        {
          accessor: "entity_type",
          title: isEvent ? "Activity" : "Object Type",
          width: COLUMN_WIDTHS.entityType,
        },
        {
          accessor: "type",
          title: "Attribute Type",
          width: COLUMN_WIDTHS.type,
          noWrap: true,
        },
        {
          accessor: "range",
          width: COLUMN_WIDTHS.range,
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
        },
        {
          accessor: "distinct_values",
          title: "Values",
          width: COLUMN_WIDTHS.distinctValues,
        },
        ...extraColumns,
      ] satisfies DataTableColumn<TypedAttribute>[],
    [data, extraColumns],
  );

  return (
    <DataTable
      noHeader
      idAccessor={"entity_type"}
      records={data ?? []}
      columns={columns}
      fetching={isFetching}
      backgroundColor={{ light: "gray.0", dark: "dark.6" }}
    />
  );
};

const AttributesTable: React.FC<{
  ocelId: string;
  entityType?: "events" | "objects";
  extraColumns?: DataTableColumn<AggregatedAttribute>[];
  subTableExtraColumns?: DataTableColumn<TypedAttribute>[];
  hideRange?: boolean;
  hideValues?: boolean;
}> = ({
  ocelId,
  entityType = "objects",
  extraColumns = [],
  hideRange = false,
  hideValues = false,
  subTableExtraColumns,
}) => {
  const isEvent = entityType === "events";

  const [currentPage, setCurrentPage] = useState(1);

  const { data: attributeNames } = useAttributeNames(ocelId, {
    entity_type: entityType,
  });

  const [filteredAttributes, setFilteredAttributes] = useState<string[]>([]);

  const { data: entityNames } = (isEvent ? useActivities : useObjectTypes)(
    ocelId,
  );

  const [filteredEntityNames, setFilteredEntityNames] = useState<string[]>([]);

  const { data, isFetching } = useAggregatedAttributes(
    ocelId,
    {
      entity_type: entityType,
      page: currentPage,
      page_size: PAGE_SIZE,
      ...(filteredAttributes.length > 0 && {
        attribute_names: filteredAttributes,
      }),
      ...(filteredEntityNames.length > 0 && {
        entity_names: filteredEntityNames,
      }),
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  const columns: DataTableColumn<AggregatedAttribute>[] = useMemo(
    () =>
      [
        {
          accessor: "selector",
          title: "",
          textAlign: "center",
          render: ({ entity_type_names, name }) => {
            if (entity_type_names.length === 1) {
              return null;
            }
            return (
              <ThemeIcon
                size={"sm"}
                variant="transparent"
                style={{ display: "flex" }}
              >
                {selectedAttributes.includes(name) ? (
                  <ChevronDownIcon size={16} />
                ) : (
                  <ChevronRightIcon size={16} />
                )}
              </ThemeIcon>
            );
          },
          width: COLUMN_WIDTHS.selector,
          cellsStyle: () => ({ padding: 5 }),
        },
        {
          accessor: "name",
          title: "Attribute Name",
          width: COLUMN_WIDTHS.name,
          filter: () => (
            <MultiSelect
              data={attributeNames}
              value={filteredAttributes}
              onChange={(newSelection) => setFilteredAttributes(newSelection)}
              comboboxProps={{ withinPortal: false }}
              clearable
              searchable
            />
          ),
          filtering: filteredAttributes.length > 0,
        },
        {
          accessor: "entityTypeField",
          title: isEvent ? "Activity" : "Object Type",
          width: COLUMN_WIDTHS.entityType,
          render: ({ entity_type_names }) =>
            `${entity_type_names.slice(0, 2).join(", ")}${entity_type_names.length > 3 ? `, ... (${entity_type_names.length} total)` : ""}`,
          filter: () => (
            <MultiSelect
              data={entityNames}
              value={filteredEntityNames}
              onChange={(newSelection) => setFilteredEntityNames(newSelection)}
              comboboxProps={{ withinPortal: false }}
              clearable
              searchable
            />
          ),
          filtering: filteredEntityNames.length > 0,
        },
        {
          accessor: "type",
          title: "Attribute Type",
          width: COLUMN_WIDTHS.type,
        },
        {
          accessor: "range",
          width: COLUMN_WIDTHS.range,
          render: ({ type, min, max }) =>
            `${formatAttributeValue(type, min)} - ${formatAttributeValue(type, max)}`,
          hidden: hideRange,
        },
        {
          accessor: "distinct_values",
          title: "Values",
          width: COLUMN_WIDTHS.distinctValues,
          hidden: hideValues,
        },
        ...extraColumns,
      ] satisfies DataTableColumn<AggregatedAttribute>[],
    [
      data,
      entityNames,
      filteredEntityNames,
      selectedAttributes,
      filteredAttributes,
      attributeNames,
      extraColumns,
    ],
  );

  return (
    <DataTable
      idAccessor={"name"}
      records={data?.response}
      columns={columns}
      withTableBorder
      fetching={isFetching}
      totalRecords={data?.total_items ?? 0}
      page={currentPage}
      recordsPerPage={PAGE_SIZE}
      onPageChange={setCurrentPage}
      noRecordsText="No attributes found"
      minHeight={300}
      maxHeight={600}
      rowExpansion={{
        allowMultiple: false,
        expandable: ({ record: { entity_type_names } }) =>
          entity_type_names.length > 1,
        expanded: {
          recordIds: selectedAttributes,
          onRecordIdsChange: setSelectedAttributes,
        },
        content: ({ record }) => (
          <SubAttributeTable
            entityType={entityType}
            attributeName={record.name}
            ocelId={ocelId}
            extraColumns={subTableExtraColumns}
            hideRange={hideRange}
            hideValues={hideValues}
            {...(filteredEntityNames.length > 0 && {
              entityNames: filteredEntityNames,
            })}
          />
        ),
      }}
    />
  );
};

export default AttributesTable;
