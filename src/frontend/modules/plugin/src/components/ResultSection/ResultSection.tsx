import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  LoadingOverlay,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { generateColor } from "@marko19907/string-to-color";
import {
  useEventCounts,
  useGetOcel,
  useGetPluginTask,
  useObjectCounts,
  useResource,
} from "@ocelescope/api-base";
import { useDownloadFile } from "@ocelescope/core";
import { ResourceModal, ResourceViewer } from "@ocelescope/resources";
import { Download, DownloadIcon } from "lucide-react";
import { useMemo, useState } from "react";

const ResourceCard: React.FC<{
  id: string;
  onClick: (resourceId: string) => void;
}> = ({ id: resourceId, onClick }) => {
  const { data: resource } = useResource(resourceId);
  const downloadFile = useDownloadFile();

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section h={200}>
        <ResourceViewer id={resourceId} isPreview />
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
            //TODO: Make this somehow typesafe
            downloadFile(`/resources/resource/${resourceId}/download`)
          }
        >
          <Download />
        </ActionIcon>
      </Group>
    </Card>
  );
};

const summarizeCount = (
  entityTypeDistribution: Record<string, number> = {},
) => {
  return {
    typeCount: Object.keys(entityTypeDistribution ?? {}).length,
    entityCount: Object.values(entityTypeDistribution ?? {}).reduce(
      (acc, curr) => acc + curr,
      0,
    ),
  };
};

export const OCELCard: React.FC<{ id: string }> = ({ id }) => {
  const { data: ocel } = useGetOcel(id);
  const { data: objectCounts } = useObjectCounts(id);
  const { data: eventCounts } = useEventCounts(id);

  const downloadFile = useDownloadFile();

  const objectSummary = useMemo(
    () => summarizeCount(objectCounts),
    [objectCounts],
  );
  const eventSummary = useMemo(
    () => summarizeCount(eventCounts),
    [eventCounts],
  );

  const ready = !!(ocel && objectCounts && eventCounts);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder pos="relative">
      <LoadingOverlay visible={!ready} />

      <Stack gap="sm" justify="space-between">
        <Group justify="space-between" align="center">
          <Title order={4}>{ocel?.name ?? "Loading…"}</Title>
          <Badge color={generateColor("OCEL")}>OCEL</Badge>
        </Group>
        <Stack>
          <Text size="sm" c="dimmed">
            {ready
              ? `${objectSummary.entityCount} objects · ${objectSummary.typeCount} types`
              : "—"}
          </Text>

          <Text size="sm" c="dimmed">
            {ready
              ? `${eventSummary.entityCount} events · ${eventSummary.typeCount} activities`
              : "—"}
          </Text>
        </Stack>
        <Button
          onClick={() => downloadFile(`/ocels/${id}/download`)}
          leftSection={<DownloadIcon />}
          disabled={!ready}
        >
          Download
        </Button>
      </Stack>
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
          id={resourceId}
          onClick={setOpenedResource}
        />
      ))}
      {pluginSummary?.output.ocel_ids?.map((ocelId) => (
        <OCELCard key={ocelId} id={ocelId} />
      ))}
    </SimpleGrid>
  );
};

export default ResultSection;
