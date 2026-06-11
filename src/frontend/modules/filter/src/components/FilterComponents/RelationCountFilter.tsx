import {
  type RelationCountSummary,
  useE2o,
  useO2o,
} from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import type { Control } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";
import { useDatatable } from "../../hooks/useDatatable";
import { useFilterColumns } from "../../hooks/useFilterColumn";

type RelationCountFilterProps = {
  ocelId: string;
  control: Control<GroupedOCELFilter>;
};

const RelationCountFilter =
  (relationType: "e2o" | "o2o") =>
  ({ ocelId, control }: RelationCountFilterProps) => {
    const isE2O = relationType === "e2o";

    const { data: relationSummary } = (isE2O ? useE2o : useO2o)(ocelId, {
      ocel_version: "original",
    });

    const { records, columns, sortStatus, setSortStatus } = useDatatable({
      data: relationSummary,
      columnNames: ["source", "qualifier", "target"],
      defaultSorted: "source",
    });

    const { filterColumn } = useFilterColumns({
      control,
      path: isE2O ? "e2o_count" : "o2o_count",
      generateFilterId: ({ source, target, qualifier }) =>
        `${source}-${qualifier}-${target}`,
      generateRecordId: ({ source, target, qualifier }) =>
        `${source}-${qualifier}-${target}`,
      generateInitialFilter: (record: RelationCountSummary) => ({
        type: isE2O ? ("e2o_count" as const) : ("o2o_count" as const),
        source: record.source,
        target: record.target,
        qualifier: record.qualifier,
        range: [record.min_count, record.max_count] as [number, number],
      }),
    });

    return (
      <DataTable
        records={records}
        columns={[...columns, ...filterColumn]}
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
      />
    );
  };

export const E2OCountFilter = RelationCountFilter("e2o");
export const O2OCountFilter = RelationCountFilter("o2o");
