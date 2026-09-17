import type {
  DirectlyFollowsGraph,
  OCDirectlyFollowsGraph,
} from "@r4pm/components";
import { useMemo } from "react";
import type { VisualizationProps } from "..";
import { R4pmViewerContainer, r4pmViewer } from "./R4pm";

const R4pmDfg = r4pmViewer((c) => c.DFGViewer);
const R4pmOcdfg = r4pmViewer((c) => c.OCDFGViewer);

type DFGVisualization = Omit<
  VisualizationProps<"r4pm_dfg">["visualization"],
  "type"
>;

const toR4pmDfg = ({
  activities,
  directly_follows_relations,
  start_activities,
  end_activities,
}: DFGVisualization): DirectlyFollowsGraph => ({
  activities: activities ?? {},
  directly_follows_relations: directly_follows_relations ?? [],
  start_activities: start_activities ?? {},
  end_activities: end_activities ?? {},
});

export const DFGViewer = ({
  visualization,
}: VisualizationProps<"r4pm_dfg">) => {
  const dfg = useMemo(() => toR4pmDfg(visualization), [visualization]);

  return (
    <R4pmViewerContainer filename="dfg">
      <R4pmDfg actions={[]} data={dfg} />
    </R4pmViewerContainer>
  );
};

export const OCDFGViewer = ({
  visualization,
}: VisualizationProps<"r4pm_ocdfg">) => {
  const ocdfg = useMemo<OCDirectlyFollowsGraph>(
    () => ({
      object_type_to_dfg: Object.fromEntries(
        Object.entries(visualization.object_type_to_dfg ?? {}).map(
          ([objectType, dfg]) => [objectType, toR4pmDfg(dfg)],
        ),
      ),
      object_counts: visualization.object_counts ?? {},
    }),
    [visualization],
  );

  return (
    <R4pmViewerContainer filename="oc-dfg">
      <R4pmOcdfg actions={[]} data={ocdfg} />
    </R4pmViewerContainer>
  );
};
