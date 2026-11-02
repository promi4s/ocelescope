import {
  Badge,
  Center,
  Group,
  LoadingOverlay,
  Stack,
  Text,
} from "@mantine/core";
import { useResource, useResourceVisualization } from "@ocelescope/api-base";
import { EyeOffIcon } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";
import type {
  VisualizationByType,
  VisualizationsType,
  VisualizationsTypes,
} from "../../types";
import { TabularView } from "./TabularView";
import { DFGViewer, OCDFGViewer } from "./Viewers/DFG";
import DotToSvgViewer from "./Viewers/Dot";
import GraphViewer from "./Viewers/Graph";
import { OCPetriNetViewer, PetriNetViewer } from "./Viewers/PetriNet";
import PlotlyViewer from "./Viewers/Plotly";
import SvgViewer from "./Viewers/SVG";
import TableView from "./Viewers/Table";

type ExtraMenuItem = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};

export type VisualizationProps<T extends VisualizationsTypes> = {
  visualization: VisualizationByType<T>;
  isPreview?: boolean;
  menuItems?: ExtraMenuItem[];
};

const visualizationMap: {
  [T in VisualizationsTypes]: ComponentType<VisualizationProps<T>>;
} = {
  table: TableView,
  svg: SvgViewer,
  graph: GraphViewer,
  dot: DotToSvgViewer,
  plotly: PlotlyViewer,
  r4pm_oc_petri_net: OCPetriNetViewer,
  r4pm_petri_net: PetriNetViewer,
  r4pm_dfg: DFGViewer,
  r4pm_ocdfg: OCDFGViewer,
};

export const Visualization = ({
  visualization,
  isPreview = false,
  menuItems,
}: VisualizationProps<VisualizationsTypes>) => {
  //TODO: Fix this stroke of a typing hell
  const Component = visualizationMap[visualization.type] as ComponentType<
    VisualizationProps<typeof visualization.type>
  >;

  return (
    <Component
      visualization={
        visualization as ComponentProps<typeof Component>["visualization"]
      }
      isPreview={isPreview}
      {...(menuItems && { menuItems })}
    />
  );
};

const LoadError = () => (
  <Center h="100%" p="md">
    <Text c="dimmed">Could not load the visualization</Text>
  </Center>
);

const NoVisualization: React.FC<{ resourceTypeLabel: string }> = ({
  resourceTypeLabel,
}) => (
  <Center h="100%" p="md">
    <Stack align="center" gap="xs">
      <EyeOffIcon
        size={64}
        strokeWidth={1.5}
        color="var(--mantine-color-dimmed)"
      />
      <Text fw={500}>No visualization available</Text>
      <Group gap={6} justify="center">
        <Badge size="sm" color="gray">
          {resourceTypeLabel}
        </Badge>
        <Text size="sm" c="dimmed">
          does not provide a visualization
        </Text>
      </Group>
    </Stack>
  </Center>
);

const ResourceVisualization: React.FC<{
  id: string;
  resourceTypeLabel: string;
  isPreview: boolean;
}> = ({ id, resourceTypeLabel, isPreview }) => {
  const { data, isError, isPending } = useResourceVisualization(id);

  if (isError) {
    return <LoadError />;
  }

  if (isPending) {
    return <LoadingOverlay visible />;
  }

  if (!data) {
    return <NoVisualization resourceTypeLabel={resourceTypeLabel} />;
  }

  return (
    <Visualization
      visualization={data as VisualizationsType}
      isPreview={isPreview}
    />
  );
};

export const ResourceViewer: React.FC<{ id: string; isPreview?: boolean }> = ({
  id,
  isPreview = false,
}) => {
  const { data: resource, isError, isPending } = useResource(id);

  if (isError) {
    return <LoadError />;
  }

  if (isPending) {
    return <LoadingOverlay visible />;
  }

  if (resource.has_visualization) {
    return (
      <ResourceVisualization
        id={id}
        resourceTypeLabel={resource.resource_type_label}
        isPreview={isPreview}
      />
    );
  }

  if (resource.kind === "tabular") {
    return <TabularView resourceId={id} />;
  }

  return <NoVisualization resourceTypeLabel={resource.resource_type_label} />;
};
