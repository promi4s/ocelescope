import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import { useResource } from "@ocelescope/api-base";
import { EyeOffIcon } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";
import type {
  VisualizationByType,
  VisualizationsType,
  VisualizationsTypes,
} from "../../types";
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

export const ResourceViewer: React.FC<{ id: string; isPreview?: boolean }> = ({
  id,
  isPreview = false,
}) => {
  const { data } = useResource(id);

  if (!data) {
    return <LoadingOverlay />;
  }

  if (!data.visualization?.type) {
    return (
      <Stack justify="center" align="center" h={"100%"}>
        <ThemeIcon w={150} h={150} variant="transparent" color="gray">
          <EyeOffIcon width={150} height={150} />
        </ThemeIcon>
      </Stack>
    );
  }

  return (
    <Visualization
      visualization={data.visualization as VisualizationsType}
      isPreview={isPreview}
    />
  );
};
