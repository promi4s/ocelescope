import { RelationTable } from "@ocelescope/core";
import { useRelationCountFilter } from "../../hooks/useRelationFilterColumns";
import type { FilterKind, FilterOf, FilterPanel } from "../../types/filter";

type RelationKey = "e2o_count" | "o2o_count";

const RelationCountPanel: (
  relationType: "e2o" | "o2o",
) => FilterPanel<RelationKey> =
  (relationType) =>
  ({ ocelId, filter, onChange }) => {
    const { filterColumns, visibleRelations } = useRelationCountFilter({
      filter,
      onChange,
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

const summary = (filter: FilterOf<RelationKey>) => {
  if (!filter.source) {
    return "No relation selected";
  }
  const [low, high] = filter.range;
  const qualifier = filter.qualifier ? ` (${filter.qualifier})` : "";
  return `${filter.source} → ${filter.target}${qualifier}: ${low ?? 0} – ${high ?? "∞"}`;
};

export const E2OCountFilter: FilterKind<"e2o_count"> = {
  title: "E2O Count",
  description:
    "Keeps the events of the source activity whose number of related objects of the target type (event-to-object relations) falls within a range. Pick the relation with Use, then set a minimum and/or maximum count. Events of other activities are left untouched.",
  Panel: RelationCountPanel("e2o") as FilterPanel<"e2o_count">,
  create: () => ({
    type: "e2o_count",
    source: "",
    target: "",
    range: [null, null],
  }),
  summary,
  isComplete: (filter) => filter.source !== "" && filter.target !== "",
};

export const O2OCountFilter: FilterKind<"o2o_count"> = {
  title: "O2O Count",
  description:
    "Keeps the objects of the source type whose number of related objects of the target type (object-to-object relations) falls within a range. Pick the relation with Use, then set a minimum and/or maximum count. Objects of other types are left untouched.",
  Panel: RelationCountPanel("o2o") as FilterPanel<"o2o_count">,
  create: () => ({
    type: "o2o_count",
    source: "",
    target: "",
    range: [null, null],
  }),
  summary,
  isComplete: (filter) => filter.source !== "" && filter.target !== "",
};
