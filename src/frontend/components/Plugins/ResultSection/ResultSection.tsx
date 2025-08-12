import { useResource } from "@/api/fastapi/resources/resources";
import { useGetPluginTask } from "@/api/fastapi/tasks/tasks";
import ResourceModal from "@/components/Resources/ResourceModal";
import Viewer from "@/components/Resources/Viewer";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  LoadingOverlay,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { Download } from "lucide-react";
import { useState } from "react";

const ResourceCard: React.FC<{
  resourceId: string;
  onClick: (resourceId: string) => void;
}> = ({ resourceId, onClick }) => {
  const { data: resource } = useResource(resourceId);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section h={200}>
        <Viewer id={resourceId} isPreview />
      </Card.Section>
      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500}>{resource?.resource.name}</Text>
        <Badge color="pink">{resource?.resource.type_label}</Badge>
      </Group>
      <Group align="center" wrap="nowrap" justify="center">
        <Button
          color="blue"
          fullWidth
          radius="md"
          onClick={() => onClick(resourceId)}
        >
          Visualize
        </Button>
        <ActionIcon
          component={"a"}
          variant="subtle"
          size={34}
          href={`http://localhost:8000/resources/${resourceId}/download`}
        >
          <Download />
        </ActionIcon>
      </Group>
    </Card>
  );
};

const ResultSection: React.FC<{ taskId?: string }> = ({ taskId }) => {
  const { data: pluginSummary } = useGetPluginTask(taskId!, {
    query: {
      refetchInterval: ({ state }) => {
        if (state.data?.state === "STARTED") {
          return 1000;
        }
        return false;
      },
    },
  });

  const [openedResource, setOpenedResource] = useState<string>();

  return (
    <SimpleGrid pos={"relative"} mih={200} cols={2}>
      <ResourceModal
        id={openedResource}
        onClose={() => setOpenedResource(undefined)}
      />
      <LoadingOverlay visible={pluginSummary?.state === "STARTED"} />
      {pluginSummary?.output.resource_ids?.map((resourceId) => (
        <ResourceCard resourceId={resourceId} onClick={setOpenedResource} />
      ))}
    </SimpleGrid>
  );
};

export default ResultSection;
