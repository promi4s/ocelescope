import { VisualizationByType, VisulizationsTypes } from "@/types/outputs";
import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import { ComponentType } from "react";
import GraphViewer from "./Viewers/graph";
import { EyeOffIcon } from "lucide-react";
import { useResource } from "@/api/fastapi/resources/resources";
import TableView from "./Viewers/table";

type VisualizationProps<T extends VisulizationsTypes> = {
  visualization: VisualizationByType<T>;
  isPreview?: boolean;
};

const visulizationMap: {
  [T in VisulizationsTypes]: ComponentType<VisualizationProps<T>>;
} = {
  table: TableView,
  graph: GraphViewer,
};

const Viewer: React.FC<{ id: string; isPreview?: boolean }> = ({
  id,
  isPreview,
}) => {
  const { data } = useResource(id);

  if (!data) {
    return <LoadingOverlay />;
  }

  if (!data.visualization) {
    return (
      <Stack justify="center" align="center" h={"100%"}>
        <ThemeIcon w={150} h={150} variant="transparent" color="gray">
          <EyeOffIcon width={150} height={150} />
        </ThemeIcon>
      </Stack>
    );
  }

  const Component = visulizationMap[data.visualization.type] as ComponentType<
    VisualizationProps<typeof data.visualization.type>
  >;

  return <Component visualization={data.visualization} isPreview={isPreview} />;
};

export default Viewer;
