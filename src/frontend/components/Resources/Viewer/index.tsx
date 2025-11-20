import type {
  VisualizationByType,
  VisulizationsType,
  VisulizationsTypes,
} from "@/types/resources";
import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import type { ComponentProps, ComponentType } from "react";
import GraphViewer from "./Viewers/graph";
import { EyeOffIcon } from "lucide-react";
import { useResource } from "@/api/fastapi/resources/resources";
import TableView from "./Viewers/table";
import SvgViewer from "./Viewers/svg";
import DotToSvgViewer from "./Viewers/dot";
import PlotlyViewer from "./Viewers/plotly";

export type VisualizationProps<T extends VisulizationsTypes> = {
  visualization: VisualizationByType<T>;
  isPreview?: boolean;
};

const visulizationMap: {
  [T in VisulizationsTypes]: ComponentType<VisualizationProps<T>>;
} = {
  table: TableView,
  svg: SvgViewer,
  graph: GraphViewer,
  dot: DotToSvgViewer,
  plotly: PlotlyViewer,
};

export const Visualization: React.FC<{
  visualization: VisulizationsType;
  isPreview?: boolean;
}> = ({ visualization, isPreview = false }) => {
  //TODO: Fix this stroke of of a typing hell
  const Component = visulizationMap[visualization.type] as ComponentType<
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

const Viewer: React.FC<{ id: string; isPreview?: boolean }> = ({
  id,
  isPreview,
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
      visualization={data.visualization as VisulizationsType}
      isPreview={isPreview}
    />
  );
};

export default Viewer;
