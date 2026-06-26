import {
  ActionIcon,
  Box,
  Center,
  Drawer,
  LoadingOverlay,
  Text,
  Tooltip,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import {
  useCreateDiscoveryTask,
  useDiscoveryTask,
  useEventCounts,
  useListDiscoveryFilters,
  useListDiscoveryMethods,
  useObjectCounts,
} from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { Visualization, type VisualizationsType } from "@ocelescope/resources";
import { SettingsIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  selectOcelFormState,
  useDiscoveryStore,
} from "../stores/discoveryStore";
import type { DiscoverySchema } from "../types";
import { getInitialFormData, normalizeFormData } from "../utils/discoveryState";
import { DiscoverySettingsContent } from "./DiscoverySettingsContent";

const PANEL_OPEN_KEY = "ocelescope:discovery:panel-open";

const DiscoveryPageContent = ({ ocelId }: { ocelId: string }) => {
  const { selectedMethodId, formDataByMethod, filters, filtersInitialized } =
    useDiscoveryStore(selectOcelFormState(ocelId));
  const setSelectedMethodId = useDiscoveryStore((s) => s.setSelectedMethodId);
  const setFormData = useDiscoveryStore((s) => s.setFormData);
  const setFiltersInStore = useDiscoveryStore((s) => s.setFilters);
  const initializeFilters = useDiscoveryStore((s) => s.initializeFilters);

  const [taskId, setTaskId] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();

  const [panelOpen, setPanelOpen] = useLocalStorage<boolean>({
    key: PANEL_OPEN_KEY,
    defaultValue: true,
  });

  const {
    data: methods = [],
    isLoading: isMethodsLoading,
    error: methodsError,
  } = useListDiscoveryMethods();

  const { data: availableFilters = [] } = useListDiscoveryFilters();

  const { data: eventCounts = {} } = useEventCounts(ocelId, undefined, {
    query: { enabled: true },
  });
  const { data: objectCounts = {} } = useObjectCounts(ocelId, undefined, {
    query: { enabled: true },
  });

  // Initialize filter defaults on first visit for this OCEL
  useEffect(() => {
    if (filtersInitialized || availableFilters.length === 0) return;
    initializeFilters(
      ocelId,
      availableFilters.map((f) => ({
        name: f.name,
        payload: getInitialFormData(f.json_schema as DiscoverySchema),
      })),
    );
  }, [filtersInitialized, availableFilters, ocelId, initializeFilters]);

  // Auto-select first method only if nothing was restored
  useEffect(() => {
    if (selectedMethodId || methods.length === 0) return;
    setSelectedMethodId(
      ocelId,
      methods
        .flatMap((m) => m.variants)
        .find((v) => v.resourceType === "DirectlyFollowsGraph")?.methodId ??
        methods[0]?.variants[0]?.methodId ??
        null,
    );
  }, [methods, selectedMethodId, ocelId, setSelectedMethodId]);

  const selectedMethod = useMemo(
    () =>
      methods.find((m) =>
        m.variants.some((v) => v.methodId === selectedMethodId),
      ) ?? null,
    [methods, selectedMethodId],
  );

  const selectedVariant = useMemo(
    () =>
      selectedMethod?.variants.find((v) => v.methodId === selectedMethodId) ??
      null,
    [selectedMethod, selectedMethodId],
  );

  const selectedSchema = (selectedVariant?.inputSchema ??
    {}) as DiscoverySchema;

  // Initialize form data defaults when a method is first selected
  useEffect(() => {
    if (!selectedMethodId || !selectedMethod) return;
    if (formDataByMethod[selectedMethodId]) return;
    setFormData(ocelId, selectedMethodId, getInitialFormData(selectedSchema));
  }, [
    selectedMethod,
    selectedMethodId,
    selectedSchema,
    formDataByMethod,
    ocelId,
    setFormData,
  ]);

  const activeFormData = selectedMethodId
    ? (formDataByMethod[selectedMethodId] ?? {})
    : {};

  const { mutate: runDiscovery, isPending: isSubmittingDiscovery } =
    useCreateDiscoveryTask({
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

  const { data: task, error: taskError } = useDiscoveryTask(taskId ?? "", {
    query: {
      enabled: !!taskId,
      refetchInterval: ({ state }) => {
        if (state.data?.state === "PENDING" || state.data?.state === "STARTED")
          return 1000;
        return false;
      },
    },
  });

  const requestPayload = useMemo(
    () => normalizeFormData(activeFormData),
    [activeFormData],
  );

  const activeFilters = useMemo(
    () =>
      filters.filter((entry) =>
        Object.values(entry.payload).every(
          (v) => !Array.isArray(v) || v.length > 0,
        ),
      ),
    [filters],
  );

  const requestSignature = useMemo(
    () =>
      JSON.stringify({
        selectedMethodId,
        requestPayload,
        ocelId,
        filters: activeFilters,
      }),
    [ocelId, requestPayload, selectedMethodId, activeFilters],
  );

  useEffect(() => {
    if (!selectedMethodId) return;
    const timeoutId = window.setTimeout(() => {
      runDiscovery({
        ocelId,
        data: {
          methodId: selectedMethodId,
          parameters: requestPayload,
          filters: activeFilters,
        },
      });
    }, 650);
    return () => window.clearTimeout(timeoutId);
  }, [
    ocelId,
    runDiscovery,
    requestSignature,
    requestPayload,
    selectedMethodId,
    activeFilters,
  ]);

  const isDiscovering =
    isSubmittingDiscovery ||
    task?.state === "PENDING" ||
    task?.state === "STARTED";

  const errorMessage =
    submitError ||
    (methodsError instanceof Error ? methodsError.message : undefined) ||
    (taskError instanceof Error ? taskError.message : undefined) ||
    (task?.state === "FAILURE"
      ? "The backend discovery task failed."
      : undefined);

  return (
    <Box pos="relative" h="100%" style={{ overflow: "hidden" }}>
      <LoadingOverlay visible={isMethodsLoading} />

      <Box pos="relative" h="100%">
        <LoadingOverlay visible={isDiscovering} />
        {task?.state === "SUCCESS" ? (
          <Box h="100%" p="sm">
            <Visualization
              visualization={task.visualization as VisualizationsType}
            />
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

        {!panelOpen && (
          <Tooltip label="Open settings" position="left" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={() => setPanelOpen(true)}
              style={{ position: "absolute", top: 12, right: 12, zIndex: 5 }}
            >
              <SettingsIcon size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      <Drawer
        opened={panelOpen}
        onClose={() => setPanelOpen(false)}
        position="right"
        title="Discovery settings"
        size={380}
        withOverlay={false}
        lockScroll={false}
        trapFocus={false}
        returnFocus={false}
        withinPortal={false}
        styles={{
          root: { position: "absolute", inset: 0, pointerEvents: "none" },
          inner: { position: "absolute", inset: 0, pointerEvents: "none" },
          content: { height: "100%", pointerEvents: "auto" },
        }}
      >
        <DiscoverySettingsContent
          methods={methods}
          selectedMethodId={selectedMethodId}
          setSelectedMethodId={(id) => setSelectedMethodId(ocelId, id)}
          selectedMethod={selectedMethod}
          selectedSchema={selectedSchema}
          activeFormData={activeFormData}
          setActiveFormData={(data) =>
            selectedMethodId && setFormData(ocelId, selectedMethodId, data)
          }
          eventCounts={eventCounts}
          objectCounts={objectCounts}
          errorMessage={errorMessage}
          availableFilters={availableFilters}
          filters={filters}
          setFilters={(next) => setFiltersInStore(ocelId, next)}
        />
      </Drawer>
    </Box>
  );
};

const DiscoveryPage = () => {
  const { id: ocelId } = useCurrentOcel();
  if (!ocelId) return <LoadingOverlay visible />;
  return <DiscoveryPageContent key={ocelId} ocelId={ocelId} />;
};

export default defineModuleRoute({
  component: DiscoveryPage,
  label: "Discovery",
  name: "discovery",
  requiresOcel: true,
});
