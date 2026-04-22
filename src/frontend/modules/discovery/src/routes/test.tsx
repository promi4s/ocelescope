import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  LoadingOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  useDiscoverDirectlyFollowsGraph,
  useDiscoverPetriNet,
  useGetDiscoveryTask,
  useResource,
} from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel, useDownloadFile } from "@ocelescope/core";
import { ResourceModal, ResourceViewer } from "@ocelescope/resources";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DiscoverySchemaForm } from "../components/DiscoverySchemaForm";
import { request } from "../lib/request";

type DiscoveryResourceType = "DirectlyFollowsGraph" | "PetriNet";

type DiscoveryMethodMeta = {
  resourceType: DiscoveryResourceType;
  label: string;
  description?: string | null;
  inputSchema: Record<string, unknown>;
};

const ResourceCard: React.FC<{
  resourceId: string;
  onInspect: (resourceId: string) => void;
}> = ({ resourceId, onInspect }) => {
  const { data: resource } = useResource(resourceId, {
    query: { enabled: !!resourceId },
  });
  const downloadFile = useDownloadFile();

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section h={220}>
        <ResourceViewer id={resourceId} isPreview />
      </Card.Section>
      <Group justify="space-between" mt="md" mb="xs" wrap="nowrap">
        <Text fw={500} truncate="end" flex={1}>
          {resource?.resource.name ?? resourceId}
        </Text>
        <Badge style={{ flexShrink: 0 }}>{resource?.resource.type ?? "resource"}</Badge>
      </Group>
      <Group wrap="nowrap">
        <Button fullWidth onClick={() => onInspect(resourceId)}>
          Inspect
        </Button>
        <ActionIcon
          variant="subtle"
          size={36}
          onClick={() => downloadFile(`/resources/resource/${resourceId}/download`)}
        >
          <Download size={18} />
        </ActionIcon>
      </Group>
    </Card>
  );
};

const DiscoveryPage = () => {
  const { id: ocelId } = useCurrentOcel();
  const [selectedMethodType, setSelectedMethodType] =
    useState<DiscoveryResourceType | null>(null);
  const [formDataByMethod, setFormDataByMethod] = useState<
    Partial<Record<DiscoveryResourceType, Record<string, unknown>>>
  >({});
  const [taskId, setTaskId] = useState<string>();
  const [openedResourceId, setOpenedResourceId] = useState<string>();

  const {
    data: methods = [],
    isLoading: isMethodsLoading,
    error: methodsError,
  } = useQuery({
    queryKey: ["discovery-meta"],
    queryFn: () =>
      request<DiscoveryMethodMeta[]>("/api/external/discovery/meta", {
        method: "GET",
      }),
    staleTime: 300_000,
  });

  useEffect(() => {
    if (selectedMethodType || methods.length === 0) {
      return;
    }

    setSelectedMethodType(
      methods.find((method) => method.resourceType === "DirectlyFollowsGraph")
        ?.resourceType ?? methods[0]?.resourceType ?? null,
    );
  }, [methods, selectedMethodType]);

  const selectedMethod = useMemo(
    () =>
      methods.find((method) => method.resourceType === selectedMethodType) ?? null,
    [methods, selectedMethodType],
  );

  const { mutate: discoverPetriNet, isPending: isDiscoveringPetriNet } =
    useDiscoverPetriNet({
      mutation: {
        onSuccess: (newTaskId) => {
          setOpenedResourceId(undefined);
          setTaskId(newTaskId);
        },
      },
    });

  const {
    mutate: discoverDirectlyFollowsGraph,
    isPending: isDiscoveringDirectlyFollowsGraph,
  } = useDiscoverDirectlyFollowsGraph({
    mutation: {
      onSuccess: (newTaskId) => {
        setOpenedResourceId(undefined);
        setTaskId(newTaskId);
      },
    },
  });

  const {
    data: task,
    error: taskError,
    isLoading: isTaskLoading,
  } = useGetDiscoveryTask(taskId ?? "", {
    query: {
      enabled: !!taskId,
      refetchInterval: ({ state }) => {
        if (
          state.data?.state === "PENDING" ||
          state.data?.state === "STARTED"
        ) {
          return 1000;
        }

        return false;
      },
    },
  });

  const activeFormData =
    (selectedMethodType && formDataByMethod[selectedMethodType]) ?? {};
  const isSubmitting = isDiscoveringPetriNet || isDiscoveringDirectlyFollowsGraph;
  const resourceIds = task?.output.resource_ids ?? [];
  const errorMessage =
    (methodsError instanceof Error && methodsError.message) ||
    (taskError instanceof Error && taskError.message) ||
    undefined;

  if (!ocelId) {
    return <LoadingOverlay visible />;
  }

  return (
    <Container fluid>
      {openedResourceId && (
        <ResourceModal
          id={openedResourceId}
          onClose={() => setOpenedResourceId(undefined)}
        />
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder pos="relative">
          <LoadingOverlay visible={isMethodsLoading || isSubmitting} />
          <Stack>
            <div>
              <Title order={2}>Discovery</Title>
              <Text c="dimmed" size="sm">
                The available parameters are loaded from the backend discovery
                schema, so new request fields appear here without frontend form
                changes.
              </Text>
            </div>

            {errorMessage && (
              <Alert color="red" title="Request failed">
                {errorMessage}
              </Alert>
            )}

            <Select
              label="Discovery Target"
              placeholder="Select a discovery method"
              value={selectedMethodType}
              onChange={(value) =>
                setSelectedMethodType(value as DiscoveryResourceType | null)
              }
              data={methods.map((method) => ({
                value: method.resourceType,
                label: method.label,
              }))}
              disabled={methods.length === 0}
            />

            {selectedMethod?.description && (
              <Text size="sm" c="dimmed">
                {selectedMethod.description}
              </Text>
            )}

            {selectedMethod && (
              <DiscoverySchemaForm
                schema={selectedMethod.inputSchema}
                formData={activeFormData}
                onChange={(data) =>
                  setFormDataByMethod((current) => ({
                    ...current,
                    [selectedMethod.resourceType]: data,
                  }))
                }
                onSubmit={(data) => {
                  if (selectedMethod.resourceType === "PetriNet") {
                    discoverPetriNet({
                      ocelId,
                      data,
                    });
                    return;
                  }

                  discoverDirectlyFollowsGraph({
                    ocelId,
                    data,
                  });
                }}
              />
            )}
          </Stack>
        </Card>

        <Card withBorder pos="relative" mih={320}>
          <LoadingOverlay
            visible={
              isTaskLoading || task?.state === "PENDING" || task?.state === "STARTED"
            }
          />
          <Stack>
            <Group justify="space-between">
              <Title order={3}>Results</Title>
              {task?.state && <Badge>{task.state}</Badge>}
            </Group>

            {!taskId && (
              <Text c="dimmed" size="sm">
                Submit a discovery request to create a backend task and inspect the
                resulting resources here.
              </Text>
            )}

            {task?.state === "FAILURE" && (
              <Alert color="red" title="Discovery failed">
                The backend task finished with a failure. Check the backend logs for
                the exception details.
              </Alert>
            )}

            {task?.state === "SUCCESS" && resourceIds.length === 0 && (
              <Alert color="yellow" title="No resources returned">
                The discovery task completed, but no resource was produced.
              </Alert>
            )}

            {resourceIds.length > 0 && (
              <SimpleGrid cols={{ base: 1, xl: 2 }}>
                {resourceIds.map((resourceId) => (
                  <ResourceCard
                    key={resourceId}
                    resourceId={resourceId}
                    onInspect={setOpenedResourceId}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Container>
  );
};

export default defineModuleRoute({
  component: DiscoveryPage,
  label: "Discovery",
  name: "discovery",
  requiresOcel: true,
});
