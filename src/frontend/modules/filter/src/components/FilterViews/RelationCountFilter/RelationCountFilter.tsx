import type { StepKind, StepPanel } from "@ocelescope/core";
import { RelationGraphInput } from "@ocelescope/core";
import type { E2OCountFilter, O2OCountFilter } from "../../../api/base";
import RelationDetail from "./RelationDetail";
import { RELATION_HOOKS, type RelationFilter, type RelationKind } from "./util";

const RelationCountPanel: (kind: RelationKind) => StepPanel<RelationFilter> = (
  kind,
) => {
  const hooks = RELATION_HOOKS[kind];
  return ({ ocelId, viewId, step: filter, onChange }) =>
    filter.source ? (
      <RelationDetail
        ocelId={ocelId}
        kind={kind}
        hooks={hooks}
        filter={filter}
        onChange={onChange}
        viewId={viewId}
        onClear={() =>
          onChange({
            type: filter.type,
            source: "",
            target: "",
            range: [null, null],
          })
        }
      />
    ) : (
      <RelationGraphInput
        ocelId={ocelId}
        viewId={viewId}
        mode={kind}
        value={null}
        onChange={(relation) => {
          if (relation) {
            onChange({
              ...filter,
              ...relation,
              direction: "source",
              range: [null, null],
            });
          }
        }}
      />
    );
};

const summary = (filter: RelationFilter) => {
  if (!filter.source) {
    return "No relation selected";
  }
  const [low, high] = filter.range;
  const qualifier = filter.qualifier ? ` (${filter.qualifier})` : "";
  return `${filter.source} → ${filter.target}${qualifier}: ${low ?? 0} – ${high ?? "∞"}`;
};

const validate = (filter: RelationFilter) =>
  filter.source && filter.target ? {} : { source: "Pick a relation" };

export const e2oCountKind: StepKind<E2OCountFilter> = {
  title: "E2O Count",
  description:
    "Keeps the events of the source activity whose number of related objects of the target type (event-to-object relations) falls within a range. Pick the relation by clicking its edge in the graph, then set a minimum and/or maximum count on its distribution. Events of other activities are left untouched.",
  Panel: RelationCountPanel("e2o") as StepPanel<E2OCountFilter>,
  create: () => ({
    type: "e2o_count",
    source: "",
    target: "",
    range: [null, null],
  }),
  summary,
  validate,
};

export const o2oCountKind: StepKind<O2OCountFilter> = {
  title: "O2O Count",
  description:
    "Keeps the objects of the source type whose number of related objects of the target type (object-to-object relations) falls within a range. Pick the relation by clicking its edge in the graph, then set a minimum and/or maximum count on its distribution. Objects of other types are left untouched.",
  Panel: RelationCountPanel("o2o") as StepPanel<O2OCountFilter>,
  create: () => ({
    type: "o2o_count",
    source: "",
    target: "",
    range: [null, null],
  }),
  summary,
  validate,
};
