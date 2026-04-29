import {
  Alert,
  Box,
  Center,
  LoadingOverlay,
  MultiSelect,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import {
  type DiscoverDFGBody,
  type DiscoverPetriNetBody,
  type DiscoveryMethodMeta,
  useDiscoverDirectlyFollowsGraph,
  useDiscoverPetriNet,
  useEventCounts,
  useGetDiscoveryMeta,
  useGetDiscoveryTask,
  useObjectCounts,
} from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { ResourceViewer } from "@ocelescope/resources";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";

type DiscoveryResourceType = DiscoveryMethodMeta["resourceType"];

type DiscoverySchema = {
  properties?: Record<string, DiscoverySchemaProperty>;
  required?: string[];
};

type DiscoverySchemaProperty = {
  title?: string;
  description?: string;
  type?: string;
  enum?: string[];
  enumNames?: string[];
  items?: DiscoverySchemaProperty;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  ["x-ui-meta"]?: {
    field_type?: string;
  };
};

const getTargetLabel = (resourceType: DiscoveryResourceType) => {
  if (resourceType === "DirectlyFollowsGraph") {
    return "DFG";
  }

  return "Petri Net";
};

const getInitialFormData = (schema: DiscoverySchema | undefined) => {
  const initial: Record<string, unknown> = {};

  for (const [name, property] of Object.entries(schema?.properties ?? {})) {
    if (property.default !== undefined) {
      initial[name] = property.default;
      continue;
    }

    if (property.type === "array") {
      initial[name] = [];
    }
  }

  return initial;
};

const normalizeFormData = (formData: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(formData).filter(([_, value]) => {
      if (value === undefined || value === null || value === "") {
        return false;
      }

      if (Array.isArray(value) && value.length === 0) {
        return false;
      }

      return true;
    }),
  );

const renderDiscoveryField = ({
  name,
  property,
  value,
  eventTypeOptions,
  objectTypeOptions,
  onChange,
}: {
  name: string;
  property: DiscoverySchemaProperty;
  value: unknown;
  eventTypeOptions: string[];
  objectTypeOptions: string[];
  onChange: (value: unknown) => void;
}) => {
  const label = property.title ?? name;
  const description = property.description;
  const fieldType = property["x-ui-meta"]?.field_type;

  if (property.type === "array" && fieldType === "event_type") {
    return (
      <MultiSelect
        label={label}
        description={description}
        value={(value as string[] | undefined) ?? []}
        onChange={onChange}
        data={eventTypeOptions}
        clearable
        searchable
      />
    );
  }

  if (property.type === "array" && fieldType === "object_type") {
    return (
      <MultiSelect
        label={label}
        description={description}
        value={(value as string[] | undefined) ?? []}
        onChange={onChange}
        data={objectTypeOptions}
        clearable
        searchable
      />
    );
  }

  if (property.type === "string" && property.enum) {
    return (
      <Select
        label={label}
        description={description}
        value={(value as string | undefined) ?? null}
        onChange={onChange}
        data={property.enum.map((item, index) => ({
          value: item,
          label: property.enumNames?.[index] ?? item,
        }))}
        allowDeselect={false}
      />
    );
  }

  if (
    (property.type === "number" || property.type === "integer") &&
    property.minimum !== undefined &&
    property.maximum !== undefined
  ) {
    const currentValue =
      typeof value === "number"
        ? value
        : (property.default as number | undefined);
    const isPercentage = property.maximum === 100 && property.minimum === 0;

    return (
      <Stack gap={6}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
        <Slider
          min={property.minimum}
          max={property.maximum}
          value={currentValue ?? property.minimum}
          onChange={onChange as (value: number) => void}
          label={(val) => (isPercentage ? `${val}%` : val)}
        />
      </Stack>
    );
  }

  if (property.type === "integer" || property.type === "number") {
    return (
      <NumberInput
        label={label}
        description={description}
        value={value as number | string | undefined}
        onChange={onChange}
        min={property.minimum}
        max={property.maximum}
      />
    );
  }

  if (property.type === "boolean") {
    return (
      <Switch
        label={label}
        description={description}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    );
  }

  return (
    <TextInput
      label={label}
      description={description}
      value={(value as string | undefined) ?? ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
};

const DiscoveryPage = () => {
  const { id: ocelId } = useCurrentOcel();
  const isMobile = useMediaQuery("(max-width: 62em)");
  const [selectedMethodType, setSelectedMethodType] =
    useState<DiscoveryResourceType | null>(null);
  const [formDataByMethod, setFormDataByMethod] = useState<
    Partial<Record<DiscoveryResourceType, Record<string, unknown>>>
  >({});
  const [taskId, setTaskId] = useState<string>();
  const [latestResourceId, setLatestResourceId] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();

  const {
    data: methods = [],
    isLoading: isMethodsLoading,
    error: methodsError,
  } = useGetDiscoveryMeta();

  const { data: eventCounts = {} } = useEventCounts(ocelId ?? "", undefined, {
    query: { enabled: !!ocelId },
  });
  const { data: objectCounts = {} } = useObjectCounts(ocelId ?? "", undefined, {
    query: { enabled: !!ocelId },
  });

  useEffect(() => {
    if (selectedMethodType || methods.length === 0) {
      return;
    }

    setSelectedMethodType(
      methods.find((method) => method.resourceType === "DirectlyFollowsGraph")
        ?.resourceType ??
        methods[0]?.resourceType ??
        null,
    );
  }, [methods, selectedMethodType]);

  const selectedMethod = useMemo(
    () =>
      methods.find((method) => method.resourceType === selectedMethodType) ??
      null,
    [methods, selectedMethodType],
  );

  const selectedSchema = (selectedMethod?.inputSchema ?? {}) as DiscoverySchema;

  useEffect(() => {
    if (!selectedMethodType || !selectedMethod) {
      return;
    }

    setFormDataByMethod((current) => {
      if (current[selectedMethodType]) {
        return current;
      }

      return {
        ...current,
        [selectedMethodType]: getInitialFormData(selectedSchema),
      };
    });
  }, [selectedMethod, selectedMethodType, selectedSchema]);

  const activeFormData =
    (selectedMethodType && formDataByMethod[selectedMethodType]) ?? {};

  const { mutate: discoverPetriNet, isPending: isDiscoveringPetriNet } =
    useDiscoverPetriNet({
      mutation: {
        onSuccess: (newTaskId) => {
          setSubmitError(undefined);
          setTaskId(newTaskId);
        },
        onError: (error) => {
          setSubmitError(
            error instanceof Error ? error.message : "Discovery failed",
          );
        },
      },
    });

  const {
    mutate: discoverDirectlyFollowsGraph,
    isPending: isDiscoveringDirectlyFollowsGraph,
  } = useDiscoverDirectlyFollowsGraph({
    mutation: {
      onSuccess: (newTaskId) => {
        setSubmitError(undefined);
        setTaskId(newTaskId);
      },
      onError: (error) => {
        setSubmitError(
          error instanceof Error ? error.message : "Discovery failed",
        );
      },
    },
  });

  const { data: task, error: taskError } = useGetDiscoveryTask(taskId ?? "", {
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

  useEffect(() => {
    const resourceId = task?.output.resource_ids?.at(-1);
    if (task?.state === "SUCCESS" && resourceId) {
      setLatestResourceId(resourceId);
    }
  }, [task]);

  const requestPayload = useMemo(
    () => normalizeFormData(activeFormData),
    [activeFormData],
  );

  const requestSignature = useMemo(
    () => JSON.stringify({ selectedMethodType, requestPayload, ocelId }),
    [ocelId, requestPayload, selectedMethodType],
  );

  useEffect(() => {
    if (!ocelId || !selectedMethodType) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (selectedMethodType === "PetriNet") {
        discoverPetriNet({
          ocelId,
          data: requestPayload as DiscoverPetriNetBody,
        });
        return;
      }

      discoverDirectlyFollowsGraph({
        ocelId,
        data: requestPayload as DiscoverDFGBody,
      });
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    discoverDirectlyFollowsGraph,
    discoverPetriNet,
    ocelId,
    requestSignature,
    requestPayload,
    selectedMethodType,
  ]);

  const isDiscovering =
    isDiscoveringPetriNet ||
    isDiscoveringDirectlyFollowsGraph ||
    task?.state === "PENDING" ||
    task?.state === "STARTED";

  const errorMessage =
    submitError ||
    (methodsError instanceof Error ? methodsError.message : undefined) ||
    (taskError instanceof Error ? taskError.message : undefined) ||
    (task?.state === "FAILURE"
      ? "The backend discovery task failed."
      : undefined);

  if (!ocelId) {
    return <LoadingOverlay visible />;
  }

  return (
    <Box
      pos="relative"
      h="100%"
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        overflow: "hidden",
      }}
    >
      <LoadingOverlay visible={isMethodsLoading} />

      {/* Canvas area */}
      <Box
        pos="relative"
        flex={1}
        mih={isMobile ? 400 : undefined}
        style={{
          borderRight: isMobile
            ? undefined
            : "1px solid var(--mantine-color-default-border)",
          borderBottom: isMobile
            ? "1px solid var(--mantine-color-default-border)"
            : undefined,
          overflow: "hidden",
        }}
      >
        <LoadingOverlay visible={Boolean(isDiscovering && latestResourceId)} />
        {latestResourceId ? (
          <Box h="100%" p="sm">
            <ResourceViewer id={latestResourceId} />
          </Box>
        ) : (
          <Center h="100%">
            <Text c="dimmed" ta="center">
              {isDiscovering
                ? "Discovering visualization..."
                : "The discovery preview will appear here."}
            </Text>
          </Center>
        )}
      </Box>

      {/* Sidebar */}
      <Box
        w={isMobile ? "100%" : 320}
        p="lg"
        style={{ overflowY: "auto", flexShrink: 0 }}
      >
        <Stack gap="md">
          <Select
            label="Target"
            value={selectedMethodType}
            onChange={(value) =>
              setSelectedMethodType(value as DiscoveryResourceType | null)
            }
            data={methods.map((method) => ({
              value: method.resourceType,
              label: getTargetLabel(method.resourceType),
            }))}
            allowDeselect={false}
          />
          {selectedMethod?.description && (
            <Text size="sm" c="dimmed">
              {selectedMethod.description}
            </Text>
          )}

          {Object.entries(selectedSchema.properties ?? {}).map(
            ([name, property]) => (
              <Box key={name}>
                {renderDiscoveryField({
                  name,
                  property,
                  value: activeFormData[name],
                  eventTypeOptions: Object.keys(eventCounts),
                  objectTypeOptions: Object.keys(objectCounts),
                  onChange: (value) =>
                    setFormDataByMethod((current) => ({
                      ...current,
                      [selectedMethodType as DiscoveryResourceType]: {
                        ...((selectedMethodType &&
                          current[
                            selectedMethodType as DiscoveryResourceType
                          ]) ??
                          {}),
                        [name]: value,
                      },
                    })),
                })}
              </Box>
            ),
          )}

          {errorMessage && (
            <Alert color="red" title="Discovery failed">
              {errorMessage}
            </Alert>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default defineModuleRoute({
  component: DiscoveryPage,
  label: "Discovery",
  name: "discovery",
  requiresOcel: true,
});
