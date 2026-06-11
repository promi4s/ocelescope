import { useE2o, useO2o } from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import type { Control } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";
import { useDatatable } from "../../hooks/useDatatable";

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

    return (
      <DataTable
        records={records}
        columns={columns}
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
      />
    );
  };

export const E2OCountFilter = RelationCountFilter("e2o");
export const O2OCountFilter = RelationCountFilter("o2o");
