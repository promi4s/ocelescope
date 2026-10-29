import type { Ocpn, PetriNet } from "@r4pm/components";
import { useMemo } from "react";
import type { VisualizationProps } from "..";
import { R4pmViewerContainer, r4pmViewer } from "./R4pm";

const R4pmOcpn = r4pmViewer((c) => c.ObjectCentricPetriNetViewer);
const R4pmPetriNet = r4pmViewer((c) => c.PetriNetViewer);

const toR4pmPetriNet = (
  visualization: VisualizationProps<"r4pm_petri_net">["visualization"],
): PetriNet => ({
  places: (visualization.places ?? []).map(({ id }) => ({ id })),
  transitions: visualization.transitions ?? [],
  arcs: visualization.arcs.map(({ source, target, weight }) => ({
    nodes: [source, target],
    ...(weight != null && { weight }),
  })),
  initial_marking: visualization.initial_marking ?? null,
  final_marking: visualization.final_marking ?? null,
});

export const OCPetriNetViewer = ({
  visualization,
}: VisualizationProps<"r4pm_oc_petri_net">) => {
  const ocpnData = useMemo<Ocpn>(
    () => ({
      places: (visualization.places ?? []).map(({ id, object_type }) => ({
        name: id,
        object_type,
      })),
      transitions: (visualization.transitions ?? []).map(({ id, label }) => ({
        name: id,
        label,
      })),
      arcs: visualization.arcs.map(({ source, target, weight, variable }) => ({
        source,
        target,
        type: variable ? "variable" : "normal",
        ...(weight != null && { weight }),
      })),
      initial_marking: visualization.initial_marking ?? {},
      final_marking: visualization.final_marking ?? {},
    }),
    [visualization],
  );

  return (
    <R4pmViewerContainer filename="oc-petri-net">
      <R4pmOcpn data={ocpnData} />
    </R4pmViewerContainer>
  );
};

export const PetriNetViewer = ({
  visualization,
}: VisualizationProps<"r4pm_petri_net">) => {
  const petriNet = useMemo(
    () => toR4pmPetriNet(visualization),
    [visualization],
  );

  return (
    <R4pmViewerContainer filename="petri-net">
      <R4pmPetriNet data={petriNet} />
    </R4pmViewerContainer>
  );
};
