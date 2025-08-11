import { useResource } from "@/api/fastapi/resources/resources";
import { useGetPluginTask } from "@/api/fastapi/tasks/tasks";
import Viewer from "@/components/Resources/Viewer";
import {
  Badge,
  Button,
  Card,
  Group,
  LoadingOverlay,
  SimpleGrid,
  Text,
} from "@mantine/core";

const ResourceCard: React.FC<{ resourceId: string }> = ({ resourceId }) => {
  const { data: resource } = useResource(resourceId);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section h={200}>
        <Viewer id={resourceId} interactable={false} />
      </Card.Section>
      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500}>{resource?.resource.name}</Text>
        <Badge color="pink">{resource?.resource.type_label}</Badge>
      </Group>
      <Button color="blue" fullWidth mt="md" radius="md">
        Visualize
      </Button>
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

  return (
    <SimpleGrid pos={"relative"} mih={200} cols={2}>
      <LoadingOverlay visible={pluginSummary?.state === "STARTED"} />
      {pluginSummary?.output.resource_ids?.map((resourceId) => (
        <ResourceCard resourceId={resourceId} />
      ))}
    </SimpleGrid>
  );
};

export default ResultSection;
