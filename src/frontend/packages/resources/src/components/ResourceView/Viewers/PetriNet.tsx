import type { ObjectCentricPetriNet, PetriNet } from "@r4pm/components";
import { useMemo } from "react";
import type { VisualizationProps } from "..";
import { R4pmViewerContainer, r4pmViewer } from "./R4pm";

const R4pmOcpn = r4pmViewer((c) => c.ObjectCentricPetriNetViewer);
const R4pmPetriNet = r4pmViewer((c) => c.PetriNetViewer);

const toR4pmPetriNet = (
  visualization:
    | VisualizationProps<"r4pm_petri_net">["visualization"]
    | VisualizationProps<"r4pm_oc_petri_net">["visualization"],
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
  const ocpnData = useMemo<ObjectCentricPetriNet>(() => {
    const places = visualization.places ?? [];

    const placeInOutMult: NonNullable<
      ObjectCentricPetriNet["place_in_out_mult"]
    > = Object.fromEntries(places.map(({ id }) => [id, [{}, {}]]));

    for (const { source, target, variable } of visualization.arcs) {
      if (!variable) continue;
      const incoming = placeInOutMult[target];
      if (incoming) incoming[0][source] = true;
      const outgoing = placeInOutMult[source];
      if (outgoing) outgoing[1][target] = true;
    }

    return {
      petri_net: toR4pmPetriNet(visualization),
      place_object_type: Object.fromEntries(
        places.map(({ id, object_type }) => [id, object_type]),
      ),
      place_in_out_mult: placeInOutMult,
    };
  }, [visualization]);

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
