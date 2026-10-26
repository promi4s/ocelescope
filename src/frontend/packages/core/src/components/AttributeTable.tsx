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
import { formatAttributeValue } from "../lib/attributes";

const PAGE_SIZE = 10;

const COLUMN_WIDTHS = {
  selector: 30,
  name: 200,
  entityType: 200,
  type: 100,
  range: 200,
  distinctValues: 120,
};

type OcelVersion = "original" | "filtered";

const SubAttributeTable: React.FC<{
  ocelId: string;
  attributeName: string;
  entityType?: "events" | "objects";
  entityNames?: string[];
  hideRange?: boolean;
  hideValues?: boolean;
  ocelVersion?: OcelVersion;
  extraColumns?: DataTableColumn<TypedAttribute>[];
  /** The attribute's rows; set, nothing is fetched. */
  data?: TypedAttribute[];
}> = ({
  ocelId,
  entityType = "objects",
  attributeName,
  entityNames,
  hideRange = false,
  hideValues = false,
  ocelVersion,
  extraColumns = [],
  data: given,
}) => {
  const isEvent = entityType === "events";

  const fetched = (isEvent ? useEventAttributes : useObjectAttributes)(
    ocelId,
    {
      attribute_names: [attributeName],
      names: entityNames,
      ocel_version: ocelVersion,
    },
    {
      query: {
        placeholderData: keepPreviousData,
        enabled: given === undefined,
      },
    },
  );
  const data = given ?? fetched.data;
  const isFetching = given === undefined && fetched.isFetching;

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
          title: "Data Type",
          width: COLUMN_WIDTHS.type,
          noWrap: true,
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
      ] satisfies DataTableColumn<TypedAttribute>[],
    [isEvent, hideRange, hideValues, extraColumns],
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
  ocelVersion?: OcelVersion;
  alwaysExpandable?: boolean;
  visibleAttributes?: string[];
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * All of the table's data at once: each attribute across its types, and per
   * type. Set, nothing is fetched -- the table filters, pages and expands it
   * itself. The type filter then narrows which attributes show, without
   * recomputing their range and values over just those types.
   */
  data?: { attributes: AggregatedAttribute[]; typed: TypedAttribute[] };
}> = ({
  ocelId,
  entityType = "objects",
  extraColumns = [],
  hideRange = false,
  hideValues = false,
  subTableExtraColumns,
  ocelVersion,
  alwaysExpandable = false,
  visibleAttributes,
  height,
  className,
  style,
  data: given,
}) => {
  const isEvent = entityType === "events";
  const fetching = given === undefined;

  const [currentPage, setCurrentPage] = useState(1);

  const { data: fetchedAttributeNames } = useAttributeNames(
    ocelId,
    { entity_type: entityType, ocel_version: ocelVersion },
    { query: { enabled: fetching } },
  );
  const attributeNames = given
    ? given.attributes.map(({ name }) => name)
    : fetchedAttributeNames;

  const [filteredAttributes, setFilteredAttributes] = useState<string[]>([]);

  const { data: fetchedEntityNames } = (
    isEvent ? useActivities : useObjectTypes
  )(ocelId, { ocel_version: ocelVersion }, { query: { enabled: fetching } });
  const entityNames = useMemo(
    () =>
      given
        ? Array.from(new Set(given.typed.map(({ entity_type }) => entity_type)))
        : fetchedEntityNames,
    [given, fetchedEntityNames],
  );

  const [filteredEntityNames, setFilteredEntityNames] = useState<string[]>([]);

  // `visibleAttributes` is an external constraint: undefined = no constraint
  // (show all), a defined array = show only those (an empty array shows none).
  const isConstrained = visibleAttributes !== undefined;

  const attributeNameOptions = useMemo(() => {
    if (!isConstrained) {
      return attributeNames ?? [];
    }
    return (attributeNames ?? []).filter((name) =>
      visibleAttributes.includes(name),
    );
  }, [attributeNames, isConstrained, visibleAttributes]);

  const effectiveAttributeNames = useMemo(() => {
    if (!isConstrained) {
      return filteredAttributes;
    }
    const base =
      filteredAttributes.length > 0 ? filteredAttributes : visibleAttributes;
    return base.filter((name) => visibleAttributes.includes(name));
  }, [filteredAttributes, isConstrained, visibleAttributes]);

  // When constrained to an empty set, show nothing instead of querying with no
  // `attribute_names` (which the API would treat as "all").
  const showNoAttributes =
    isConstrained && effectiveAttributeNames.length === 0;

  const fetched = useAggregatedAttributes(
    ocelId,
    {
      entity_type: entityType,
      page: currentPage,
      page_size: PAGE_SIZE,
      ocel_version: ocelVersion,
      ...(effectiveAttributeNames.length > 0 && {
        attribute_names: effectiveAttributeNames,
      }),
      ...(filteredEntityNames.length > 0 && {
        entity_names: filteredEntityNames,
      }),
    },
    {
      query: {
        placeholderData: keepPreviousData,
        enabled: fetching && !showNoAttributes,
      },
    },
  );

  // the given attributes, filtered like the server would
  const givenRows = useMemo(() => {
    if (!given) {
      return [];
    }
    return given.attributes
      .filter(
        ({ name }) =>
          effectiveAttributeNames.length === 0 ||
          effectiveAttributeNames.includes(name),
      )
      .map((attribute) =>
        filteredEntityNames.length === 0
          ? attribute
          : {
              ...attribute,
              entity_type_names: attribute.entity_type_names.filter((name) =>
                filteredEntityNames.includes(name),
              ),
            },
      )
      .filter(({ entity_type_names }) => entity_type_names.length > 0);
  }, [given, effectiveAttributeNames, filteredEntityNames]);

  const records = given
    ? givenRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : fetched.data?.response;
  const totalRecords = given
    ? givenRows.length
    : (fetched.data?.total_items ?? 0);
  const isFetching = fetching && fetched.isFetching;

  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  const columns: DataTableColumn<AggregatedAttribute>[] = useMemo(
    () =>
      [
        {
          accessor: "selector",
          title: "",
          textAlign: "center",
          render: ({ entity_type_names, name }) => {
            if (!alwaysExpandable && entity_type_names.length === 1) {
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
              data={attributeNameOptions}
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
          title: "Data Type",
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
      isEvent,
      entityNames,
      filteredEntityNames,
      selectedAttributes,
      filteredAttributes,
      attributeNameOptions,
      extraColumns,
      hideRange,
      hideValues,
      alwaysExpandable,
    ],
  );

  return (
    <DataTable
      idAccessor={"name"}
      records={showNoAttributes ? [] : records}
      columns={columns}
      withTableBorder
      fetching={isFetching}
      totalRecords={showNoAttributes ? 0 : totalRecords}
      page={currentPage}
      recordsPerPage={PAGE_SIZE}
      onPageChange={setCurrentPage}
      noRecordsText="No attributes found"
      height={height}
      className={className}
      style={{ flex: 1, minHeight: 0, ...style }}
      rowExpansion={{
        allowMultiple: false,
        expandable: ({ record: { entity_type_names } }) =>
          alwaysExpandable || entity_type_names.length > 1,
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
            ocelVersion={ocelVersion}
            {...(filteredEntityNames.length > 0 && {
              entityNames: filteredEntityNames,
            })}
            {...(given && {
              data: given.typed.filter(
                ({ name, entity_type }) =>
                  name === record.name &&
                  (filteredEntityNames.length === 0 ||
                    filteredEntityNames.includes(entity_type)),
              ),
            })}
          />
        ),
      }}
    />
  );
};

export default AttributesTable;
