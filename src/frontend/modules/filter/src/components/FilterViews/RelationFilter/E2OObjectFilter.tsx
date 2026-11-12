import { SegmentedControl } from "@mantine/core";
import {
  RelationGraphInput,
  type StepKind,
  type StepPanel,
} from "@ocelescope/core";
import type { E2OObjectFilter } from "../../../api/base";
import RelationDetail from "./components/RelationDetail";

const DEFAULT_RANGE: E2OObjectFilter["range"] = [1, null];

const E2OObjectPanel: StepPanel<E2OObjectFilter> = ({
  ocelId,
  viewId,
  step: filter,
  onChange,
}) =>
  filter.source ? (
    <RelationDetail
      ocelId={ocelId}
      viewId={viewId}
      kind="e2o"
      source={filter.source}
      target={filter.target}
      qualifier={filter.qualifier ?? null}
      direction="source"
      range={filter.range}
      exclude={filter.mode === "exclude"}
      countedLabel="Events"
      caption={`How many ${filter.target} objects each ${filter.source} event is related to; the objects of the events in range are kept`}
      onQualifierChange={(qualifier) => onChange({ ...filter, qualifier })}
      onRangeChange={(range) => onChange({ ...filter, range })}
      onClear={() =>
        onChange({ ...filter, source: "", target: "", qualifier: null })
      }
    >
      <SegmentedControl
        size="xs"
        value={filter.mode ?? "include"}
        data={[
          { label: "Include", value: "include" },
          { label: "Exclude", value: "exclude" },
        ]}
        onChange={(next) =>
          onChange({ ...filter, mode: next as "include" | "exclude" })
        }
      />
    </RelationDetail>
  ) : (
    <RelationGraphInput
      ocelId={ocelId}
      viewId={viewId}
      mode="e2o"
      value={null}
      onChange={(relation) => {
        if (relation) {
          onChange({ ...filter, ...relation, range: DEFAULT_RANGE });
        }
      }}
    />
  );

export const e2oObjectKind: StepKind<E2OObjectFilter> = {
  title: "E2O Objects",
  description:
    "Keeps the objects (of any type) that take part in an event of the source activity whose number of related objects of the target type falls within a range, by default at least one. Pick the relation in the graph, then set the range and optionally a qualifier. All other objects are dropped; with Exclude it is the other way around.",
  Panel: E2OObjectPanel,
  create: () => ({
    type: "e2o_object",
    source: "",
    target: "",
    range: DEFAULT_RANGE,
  }),
  summary: (filter) => {
    if (!filter.source) {
      return "No relation selected";
    }
    const [low, high] = filter.range;
    const qualifier = filter.qualifier ? ` (${filter.qualifier})` : "";
    const verb = filter.mode === "exclude" ? "Drop" : "Keep";
    return `${verb} objects of ${filter.source} → ${filter.target}${qualifier}: ${low ?? 0} – ${high ?? "∞"}`;
  },
  validate: (filter) =>
    filter.source && filter.target ? {} : { source: "Pick a relation" },
};
