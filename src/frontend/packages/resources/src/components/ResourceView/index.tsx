import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import { useResource } from "@ocelescope/api-base";
import { EyeOffIcon } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";
import type {
  VisualizationByType,
  VisualizationsType,
  VisualizationsTypes,
} from "../../types";
import DotToSvgViewer from "./Viewers/Dot";
import GraphViewer from "./Viewers/Graph";
import PlotlyViewer from "./Viewers/Plotly";
import SvgViewer from "./Viewers/SVG";
import TableView from "./Viewers/Table";

export type VisualizationProps<T extends VisualizationsTypes> = {
  visualization: VisualizationByType<T>;
  isPreview?: boolean;
};

const visualizationMap: {
  [T in VisualizationsTypes]: ComponentType<VisualizationProps<T>>;
} = {
  table: TableView,
  svg: SvgViewer,
  graph: GraphViewer,
  dot: DotToSvgViewer,
  plotly: PlotlyViewer,
};

export const Visualization: React.FC<{
  visualization: VisualizationsType;
  isPreview?: boolean;
}> = ({ visualization, isPreview = false }) => {
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
