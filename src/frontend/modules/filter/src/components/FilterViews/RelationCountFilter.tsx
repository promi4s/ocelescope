import { RelationTable } from "@ocelescope/core";
import { useRelationCountFilter } from "../../hooks/useRelationFilterColumns";
import type { FilterView, FilterViewType } from "../../types/filter";

const RelationCountFilter: (
  relationType: "e2o" | "o2o",
) => FilterView<"e2o_count" | "o2o_count"> =
  (relationType) =>
  ({ ocelId, control }) => {
    const isE2O = relationType === "e2o";

    const { filterColumns, visibleRelations } = useRelationCountFilter({
      control,
      path: isE2O ? "e2o_count" : "o2o_count",
    });

    return (
      <RelationTable
        ocelId={ocelId}
        ocelVersion={"original"}
        relationType={relationType}
        extraColumns={filterColumns}
        subTableExtraColumns={filterColumns}
        visibleRelations={visibleRelations}
        hideRange
        hideTotal
      />
    );
  };

export const E2OCountFilter: FilterViewType<"e2o_count"> = {
  title: "E2O Count",
  description:
    "Filters events of the source type by the number of objects they are related to (event-to-object relations). For each relation, you can set a minimum and/or maximum count. Events of the source type whose number of related objects does not fall within the specified range are filtered out. Relations without a range are ignored.",
  ViewComponent: RelationCountFilter("e2o"),
  generateDefault: () => [],
};

export const O2OCountFilter: FilterViewType<"o2o_count"> = {
  title: "O2O Count",
  description:
    "Filters objects of the source type by the number of other objects they are related to (object-to-object relations). For each relation, you can set a minimum and/or maximum count. Objects of the source type whose number of related objects does not fall within the specified range are filtered out. Relations without a range are ignored.",
  ViewComponent: RelationCountFilter("o2o"),
  generateDefault: () => [],
};
