import { Box } from "@mantine/core";
import type {
  ObjectCentricPetriNet,
  ObjectCentricPetriNetViewerProps,
  PetriNet,
  PetriNetViewerProps,
} from "@r4pm/components";
import dynamic from "next/dynamic";
import { type ReactNode, useMemo } from "react";
import type { VisualizationProps } from "..";

const loadR4pm = async () => {
  const [components, { wasmLayout }] = await Promise.all([
    import("@r4pm/components"),
    import("@r4pm/components/rust-layout/wasm"),
  ]);
  const viewerConfig = { layout: wasmLayout };
  const { ViewerConfigProvider } = components;

  const WithLayout = ({ children }: { children: ReactNode }) => (
    <ViewerConfigProvider value={viewerConfig}>{children}</ViewerConfigProvider>
  );

  return { components, WithLayout };
};

const R4pmOcpn = dynamic(
  async () => {
    const {
      components: { ObjectCentricPetriNetViewer },
      WithLayout,
    } = await loadR4pm();

    return (props: ObjectCentricPetriNetViewerProps) => (
      <WithLayout>
        <ObjectCentricPetriNetViewer {...props} />
      </WithLayout>
    );
  },
  { ssr: false },
);

const R4pmPetriNet = dynamic(
  async () => {
    const {
      components: { PetriNetViewer },
      WithLayout,
    } = await loadR4pm();

    return (props: PetriNetViewerProps) => (
      <WithLayout>
        <PetriNetViewer {...props} />
      </WithLayout>
    );
  },
  { ssr: false },
);

const ExportFrame = dynamic(
  () => import("@r4pm/components").then((c) => c.ViewerExportFrame),
  { ssr: false },
);

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

const ViewerContainer = ({
  filename,
  children,
}: {
  filename: string;
  children: ReactNode;
}) => (
  <Box h="100%" w="100%" pos="relative" style={{ overflow: "hidden" }}>
    <ExportFrame filename={filename} style={{ height: "100%" }}>
      {children}
    </ExportFrame>
  </Box>
);

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
    <ViewerContainer filename="oc-petri-net">
      <R4pmOcpn data={ocpnData} />
    </ViewerContainer>
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
    <ViewerContainer filename="petri-net">
      <R4pmPetriNet data={petriNet} />
    </ViewerContainer>
  );
};
