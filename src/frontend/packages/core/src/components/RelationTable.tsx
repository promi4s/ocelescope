import { MultiSelect, ThemeIcon } from "@mantine/core";
import {
  type RelationCountSummary,
  useActivities,
  useE2o,
  useO2o,
  useObjectTypes,
} from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

const COLUMN_WIDTHS = {
  selector: 30,
  source: 220,
  target: 220,
  range: 160,
  total: 120,
};

type RelationType = "o2o" | "e2o";
type Direction = "source" | "target";
type OcelVersion = "original" | "filtered";

const relationId = ({ source, target }: RelationCountSummary) =>
  `${source} ${target}`;

const SubRelationTable: React.FC<{
  ocelId: string;
  relationType: RelationType;
  direction: Direction;
  source: string;
  target: string;
  hideRange?: boolean;
  hideTotal?: boolean;
  ocelVersion?: OcelVersion;
  extraColumns?: DataTableColumn<RelationCountSummary>[];
}> = ({
  ocelId,
  relationType,
  direction,
  source,
  target,
  hideRange = false,
  hideTotal = false,
  ocelVersion,
  extraColumns = [],
}) => {
  const useRelations = relationType === "e2o" ? useE2o : useO2o;

  const { data, isFetching } = useRelations(
    ocelId,
    {
      direction,
      source_types: [source],
      target_types: [target],
      with_qualifier: true,
      ocel_version: ocelVersion,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const columns: DataTableColumn<RelationCountSummary>[] = useMemo(
    () =>
      [
        {
          accessor: "selector",
          title: "",
          width: COLUMN_WIDTHS.selector,
        },
        {
          accessor: "qualifier",
          title: "Qualifier",
          width: COLUMN_WIDTHS.source + COLUMN_WIDTHS.target,
          render: ({ qualifier }) => qualifier || <i>No qualifier</i>,
        },
        {
          accessor: "range",
          title: "Range",
          width: COLUMN_WIDTHS.range,
          render: ({ min_count, max_count }) => `${min_count} - ${max_count}`,
          hidden: hideRange,
        },
        {
          accessor: "sum",
          title: "Total",
          width: COLUMN_WIDTHS.total,
          hidden: hideTotal,
        },
        ...extraColumns,
      ] satisfies DataTableColumn<RelationCountSummary>[],
    [hideRange, hideTotal, extraColumns],
  );

  return (
    <DataTable
      noHeader
      idAccessor={"qualifier"}
      records={data?.response ?? []}
      columns={columns}
      fetching={isFetching}
      backgroundColor={{ light: "gray.0", dark: "dark.6" }}
    />
  );
};

const RelationTable: React.FC<{
  ocelId: string;
  relationType?: RelationType;
  direction?: Direction;
  extraColumns?: DataTableColumn<RelationCountSummary>[];
  subTableExtraColumns?: DataTableColumn<RelationCountSummary>[];
  hideRange?: boolean;
  hideTotal?: boolean;
  ocelVersion?: OcelVersion;
}> = ({
  ocelId,
  relationType = "o2o",
  direction = "source",
  extraColumns = [],
  subTableExtraColumns,
  hideRange = false,
  hideTotal = false,
  ocelVersion,
}) => {
  const isE2O = relationType === "e2o";
  const isSource = direction === "source";

  const [currentPage, setCurrentPage] = useState(1);

  const { data: objectTypes = [] } = useObjectTypes(ocelId, {
    ocel_version: ocelVersion,
  });
  const { data: activities = [] } = useActivities(ocelId, {
    ocel_version: ocelVersion,
  });

  // For E2O the source side is the activity and the target side the object type
  // (swapped when reading from the target perspective). O2O is object→object.
  const sourceOptions = isE2O
    ? isSource
      ? activities
      : objectTypes
    : objectTypes;
  const targetOptions = isE2O
    ? isSource
      ? objectTypes
      : activities
    : objectTypes;
  const sourceTitle = isE2O
    ? isSource
      ? "Activity"
      : "Object Type"
    : "Source";
  const targetTitle = isE2O
    ? isSource
      ? "Object Type"
      : "Activity"
    : "Target";

  const [filteredSources, setFilteredSources] = useState<string[]>([]);
  const [filteredTargets, setFilteredTargets] = useState<string[]>([]);

  const useRelations = isE2O ? useE2o : useO2o;

  const { data, isFetching } = useRelations(
    ocelId,
    {
      direction,
      page: currentPage,
      page_size: PAGE_SIZE,
      with_qualifier: false,
      ocel_version: ocelVersion,
      ...(filteredSources.length > 0 && { source_types: filteredSources }),
      ...(filteredTargets.length > 0 && { target_types: filteredTargets }),
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const [selectedRelations, setSelectedRelations] = useState<string[]>([]);

  const columns: DataTableColumn<RelationCountSummary>[] = useMemo(
    () =>
      [
        {
          accessor: "selector",
          title: "",
          textAlign: "center",
          width: COLUMN_WIDTHS.selector,
          cellsStyle: () => ({ padding: 5 }),
          render: (record) => (
            <ThemeIcon
              size={"sm"}
              variant="transparent"
              style={{ display: "flex" }}
            >
              {selectedRelations.includes(relationId(record)) ? (
                <ChevronDownIcon size={16} />
              ) : (
                <ChevronRightIcon size={16} />
              )}
            </ThemeIcon>
          ),
        },
        {
          accessor: "source",
          title: sourceTitle,
          width: COLUMN_WIDTHS.source,
          filter: () => (
            <MultiSelect
              data={sourceOptions}
              value={filteredSources}
              onChange={setFilteredSources}
              comboboxProps={{ withinPortal: false }}
              clearable
              searchable
            />
          ),
          filtering: filteredSources.length > 0,
        },
        {
          accessor: "target",
          title: targetTitle,
          width: COLUMN_WIDTHS.target,
          filter: () => (
            <MultiSelect
              data={targetOptions}
              value={filteredTargets}
              onChange={setFilteredTargets}
              comboboxProps={{ withinPortal: false }}
              clearable
              searchable
            />
          ),
          filtering: filteredTargets.length > 0,
        },
        {
          accessor: "range",
          title: "Range",
          width: COLUMN_WIDTHS.range,
          render: ({ min_count, max_count }) => `${min_count} - ${max_count}`,
          hidden: hideRange,
        },
        {
          accessor: "sum",
          title: "Total",
          width: COLUMN_WIDTHS.total,
          hidden: hideTotal,
        },
        ...extraColumns,
      ] satisfies DataTableColumn<RelationCountSummary>[],
    [
      sourceTitle,
      targetTitle,
      sourceOptions,
      targetOptions,
      filteredSources,
      filteredTargets,
      selectedRelations,
      hideRange,
      hideTotal,
      extraColumns,
    ],
  );

  return (
    <DataTable
      idAccessor={relationId}
      records={data?.response}
      columns={columns}
      withTableBorder
      fetching={isFetching}
      totalRecords={data?.total_items ?? 0}
      page={currentPage}
      recordsPerPage={PAGE_SIZE}
      onPageChange={setCurrentPage}
      noRecordsText="No relations found"
      height={500}
      rowExpansion={{
        allowMultiple: false,
        expanded: {
          recordIds: selectedRelations,
          onRecordIdsChange: setSelectedRelations,
        },
        content: ({ record }) => (
          <SubRelationTable
            ocelId={ocelId}
            relationType={relationType}
            direction={direction}
            source={record.source}
            target={record.target}
            hideRange={hideRange}
            hideTotal={hideTotal}
            ocelVersion={ocelVersion}
            extraColumns={subTableExtraColumns}
          />
        ),
      }}
    />
  );
};

export default RelationTable;
