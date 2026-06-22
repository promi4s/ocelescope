import { MultiSelect, ThemeIcon } from "@mantine/core";
import {
  type RelationCountSummary,
  useE2o,
  useE2oCombinations,
  useO2o,
  useO2oCombinations,
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
  qualifier: 220,
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
          accessor: "source",
          title: "",
          width: COLUMN_WIDTHS.source,
          render: () => null,
        },
        {
          accessor: "target",
          title: "",
          width: COLUMN_WIDTHS.target,
          render: () => null,
        },
        {
          accessor: "qualifier",
          title: "Qualifier",
          width: COLUMN_WIDTHS.qualifier,
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
  visibleRelations?: { source: string; target: string }[];
}> = ({
  ocelId,
  relationType = "o2o",
  direction = "source",
  extraColumns = [],
  subTableExtraColumns,
  hideRange = false,
  hideTotal = false,
  ocelVersion,
  visibleRelations,
}) => {
  const isE2O = relationType === "e2o";
  const isSource = direction === "source";

  const [currentPage, setCurrentPage] = useState(1);

  const { data: combinations = [] } = (
    isE2O ? useE2oCombinations : useO2oCombinations
  )(ocelId, { direction, ocel_version: ocelVersion });

  const sourceOptions = useMemo(
    () => Array.from(new Set(combinations.map(({ source }) => source))),
    [combinations],
  );
  const targetOptions = useMemo(
    () => Array.from(new Set(combinations.map(({ target }) => target))),
    [combinations],
  );
  const qualifierOptions = useMemo(
    () => Array.from(new Set(combinations.map(({ qualifier }) => qualifier))),
    [combinations],
  );

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
  const [filteredQualifiers, setFilteredQualifiers] = useState<string[]>([]);

  const isConstrained = visibleRelations !== undefined;

  const visibleSources = useMemo(
    () =>
      isConstrained
        ? Array.from(new Set(visibleRelations.map(({ source }) => source)))
        : [],
    [isConstrained, visibleRelations],
  );
  const visibleTargets = useMemo(
    () =>
      isConstrained
        ? Array.from(new Set(visibleRelations.map(({ target }) => target)))
        : [],
    [isConstrained, visibleRelations],
  );

  const sourceSelectOptions = isConstrained
    ? sourceOptions.filter((option) => visibleSources.includes(option))
    : sourceOptions;
  const targetSelectOptions = isConstrained
    ? targetOptions.filter((option) => visibleTargets.includes(option))
    : targetOptions;

  const effectiveSources = useMemo(() => {
    if (!isConstrained) return filteredSources;
    return filteredSources.length > 0
      ? filteredSources.filter((source) => visibleSources.includes(source))
      : visibleSources;
  }, [isConstrained, filteredSources, visibleSources]);

  const effectiveTargets = useMemo(() => {
    if (!isConstrained) return filteredTargets;
    return filteredTargets.length > 0
      ? filteredTargets.filter((target) => visibleTargets.includes(target))
      : visibleTargets;
  }, [isConstrained, filteredTargets, visibleTargets]);

  const showNoRelations =
    isConstrained &&
    (effectiveSources.length === 0 || effectiveTargets.length === 0);

  const useRelations = isE2O ? useE2o : useO2o;

  const { data, isFetching } = useRelations(
    ocelId,
    {
      direction,
      page: currentPage,
      page_size: PAGE_SIZE,
      with_qualifier: false,
      ocel_version: ocelVersion,
      ...(effectiveSources.length > 0 && { source_types: effectiveSources }),
      ...(effectiveTargets.length > 0 && { target_types: effectiveTargets }),
      ...(filteredQualifiers.length > 0 && { qualifiers: filteredQualifiers }),
    },
    {
      query: { placeholderData: keepPreviousData, enabled: !showNoRelations },
    },
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
          render: (record) => {
            if ((record.qualifiers?.length ?? 0) <= 1) {
              return null;
            }
            return (
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
            );
          },
        },
        {
          accessor: "source",
          title: sourceTitle,
          width: COLUMN_WIDTHS.source,
          filter: () => (
            <MultiSelect
              data={sourceSelectOptions}
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
              data={targetSelectOptions}
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
          accessor: "qualifiers",
          title: "Qualifiers",
          width: COLUMN_WIDTHS.qualifier,
          render: ({ qualifiers = [] }) => {
            const labels = qualifiers.map(
              (qualifier) => qualifier || "No qualifier",
            );
            return `${labels.slice(0, 2).join(", ")}${labels.length > 2 ? `, ... (${labels.length})` : ""}`;
          },
          filter: () => (
            <MultiSelect
              data={qualifierOptions}
              value={filteredQualifiers}
              onChange={setFilteredQualifiers}
              comboboxProps={{ withinPortal: false }}
              clearable
              searchable
            />
          ),
          filtering: filteredQualifiers.length > 0,
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
      sourceSelectOptions,
      targetSelectOptions,
      qualifierOptions,
      filteredSources,
      filteredTargets,
      filteredQualifiers,
      selectedRelations,
      hideRange,
      hideTotal,
      extraColumns,
    ],
  );

  return (
    <DataTable
      idAccessor={relationId}
      records={showNoRelations ? [] : data?.response}
      columns={columns}
      withTableBorder
      fetching={isFetching}
      totalRecords={showNoRelations ? 0 : (data?.total_items ?? 0)}
      page={currentPage}
      recordsPerPage={PAGE_SIZE}
      onPageChange={setCurrentPage}
      noRecordsText="No relations found"
      height={500}
      rowExpansion={{
        allowMultiple: false,
        expandable: ({ record }) => (record.qualifiers?.length ?? 0) > 1,
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
