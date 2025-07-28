import { useOutput } from "@/api/fastapi/outputs/outputs";
import { VisualizationByType, VisulizationsTypes } from "@/types/outputs";
import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import { ComponentType } from "react";
import GraphViewer from "./Viewers/graph";
import { EyeOffIcon } from "lucide-react";

type VisualizationProps<T extends VisulizationsTypes> = {
  visualization: VisualizationByType<T>;
  interactable?: boolean;
};

const visulizationMap = {
  cytoscape: ({}) => <></>,
  graph: ({ visualization, interactable }) => (
    <GraphViewer visualization={visualization} interactable={interactable} />
  ),
} satisfies {
  [T in VisulizationsTypes]: ComponentType<VisualizationProps<T>>;
};

const Viewer: React.FC<{ id: string; interactable?: boolean }> = ({
  id,
  interactable = true,
}) => {
  const { data } = useOutput(id);

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

  return (
    <Component visualization={data.visualization} interactable={interactable} />
  );
};

export default Viewer;
