import { useResource } from "@/api/fastapi/resources/resources";
import { useGetPluginTask } from "@/api/fastapi/tasks/tasks";
import ResourceModal from "@/components/Resources/ResourceModal";
import Viewer from "@/components/Resources/Viewer";
import { useDownloadFile } from "@/hooks/useDownload";
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
  const downloadFile = useDownloadFile();

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section h={200}>
        <Viewer id={resourceId} isPreview />
      </Card.Section>
      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500} truncate="end" flex={1} mr={"md"}>
          {resource?.resource.name}
        </Text>
        <Badge color="pink" style={{ flexShrink: 0 }}>
          {resource?.resource.type}
        </Badge>
      </Group>
      <Group align="center" wrap="nowrap" justify="center">
        <Button
          color="blue"
          fullWidth
          radius="md"
          onClick={() => onClick(resourceId)}
        >
          Inspect
        </Button>
        <ActionIcon
          component={"a"}
          variant="subtle"
          size={34}
          onClick={() =>
            downloadFile(`/resources/resource/${resourceId}/download`)
          }
        >
          <Download />
        </ActionIcon>
      </Group>
    </Card>
  );
};

const ResultSection: React.FC<{ taskId: string }> = ({ taskId }) => {
  const { data: pluginSummary } = useGetPluginTask(taskId, {
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
      {openedResource && (
        <ResourceModal
          id={openedResource}
          onClose={() => setOpenedResource(undefined)}
        />
      )}
      <LoadingOverlay visible={pluginSummary?.state === "STARTED"} />
      {pluginSummary?.output.resource_ids?.map((resourceId) => (
        <ResourceCard
          key={resourceId}
          resourceId={resourceId}
          onClick={setOpenedResource}
        />
      ))}
    </SimpleGrid>
  );
};

export default ResultSection;
