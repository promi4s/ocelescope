import { Box, Center, LoadingOverlay, Text } from "@mantine/core";
import {
  useCreateDiscoveryTask,
  useEventCounts,
  useGetDiscoveryTask,
  useListDiscoveryMethods,
  useObjectCounts,
} from "@ocelescope/api-base";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";
import { ResourceViewer } from "@ocelescope/resources";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DiscoverySchema } from "../types";
import { DiscoverySettingsContent } from "./DiscoverySettingsContent";
import { DiscoverySettingsPanel } from "./DiscoverySettingsPanel";
import {
  getInitialFormData,
  getSettingsKey,
  loadPanelState,
  loadStoredSettings,
  normalizeFormData,
  PANEL_KEY,
  PANEL_MAX,
  PANEL_MIN,
} from "../utils/discoveryState";

const DiscoveryPageContent = ({
  ocelId,
  panelWidth,
  setPanelWidth,
  isPanelCollapsed,
  setIsPanelCollapsed,
}: {
  ocelId: string;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  isPanelCollapsed: boolean;
  setIsPanelCollapsed: (v: boolean) => void;
}) => {
  const initialSettings = loadStoredSettings(ocelId);

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    initialSettings.selectedMethodId ??
      initialSettings.selectedMethodType ??
      null,
  );
  const [formDataByMethod, setFormDataByMethod] = useState<
    Partial<Record<string, Record<string, unknown>>>
  >(initialSettings.formDataByMethod ?? {});

  const [taskId, setTaskId] = useState<string>();
  const [latestResourceId, setLatestResourceId] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Persist settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        getSettingsKey(ocelId),
        JSON.stringify({ selectedMethodId, formDataByMethod }),
      );
    } catch {}
  }, [ocelId, selectedMethodId, formDataByMethod]);

  const handleResizeStart = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setPanelWidth(
        Math.max(
          PANEL_MIN,
          Math.min(PANEL_MAX, dragRef.current.startWidth + delta),
        ),
      );
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const {
    data: methods = [],
    isLoading: isMethodsLoading,
    error: methodsError,
  } = useListDiscoveryMethods();

  const { data: eventCounts = {} } = useEventCounts(ocelId, undefined, {
    query: { enabled: true },
  });
  const { data: objectCounts = {} } = useObjectCounts(ocelId, undefined, {
    query: { enabled: true },
  });

  // Auto-select first method only if nothing was restored
  useEffect(() => {
    if (selectedMethodId || methods.length === 0) return;
    setSelectedMethodId(
      methods.flatMap((m) => m.variants).find((v) => v.resourceType === "DirectlyFollowsGraph")
        ?.methodId ??
        methods[0]?.variants[0]?.methodId ??
        null,
    );
  }, [methods, selectedMethodId]);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.variants.some((v) => v.methodId === selectedMethodId)) ?? null,
    [methods, selectedMethodId],
  );

  const selectedSchema = (selectedMethod?.inputSchema ?? {}) as DiscoverySchema;

  // Initialize form data defaults when a method is first selected
  useEffect(() => {
    if (!selectedMethodId || !selectedMethod) return;
    setFormDataByMethod((current) => {
      if (current[selectedMethodId]) return current;
      return {
        ...current,
        [selectedMethodId]: getInitialFormData(selectedSchema),
      };
    });
  }, [selectedMethod, selectedMethodId, selectedSchema]);

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

  const { data: task, error: taskError } = useGetDiscoveryTask(taskId ?? "", {
    query: {
      enabled: !!taskId,
      refetchInterval: ({ state }) => {
        if (state.data?.state === "PENDING" || state.data?.state === "STARTED")
          return 1000;
        return false;
      },
    },
  });

  useEffect(() => {
    const resourceId = task?.output.resource_ids?.at(-1);
    if (task?.state === "SUCCESS" && resourceId)
      setLatestResourceId(resourceId);
  }, [task]);

  const requestPayload = useMemo(
    () => normalizeFormData(activeFormData),
    [activeFormData],
  );

  const requestSignature = useMemo(
    () => JSON.stringify({ selectedMethodId, requestPayload, ocelId }),
    [ocelId, requestPayload, selectedMethodId],
  );

  useEffect(() => {
    if (!selectedMethodId) return;
    const timeoutId = window.setTimeout(() => {
      runDiscovery({
        ocelId,
        data: {
          methodId: selectedMethodId,
          parameters: requestPayload,
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

  const settingsProps = {
    methods,
    selectedMethodId,
    setSelectedMethodId,
    selectedMethod,
    selectedSchema,
    activeFormData,
    setFormDataByMethod,
    eventCounts,
    objectCounts,
    errorMessage,
  };

  return (
    <Box
      pos="relative"
      h="100%"
      style={{
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <LoadingOverlay visible={isMethodsLoading} />

      {/* Canvas area */}
      <Box pos="relative" flex={1} style={{ overflow: "hidden" }}>
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

      <DiscoverySettingsPanel
        width={panelWidth}
        collapsed={isPanelCollapsed}
        onCollapseChange={setIsPanelCollapsed}
        onResizeStart={handleResizeStart}
      >
        <DiscoverySettingsContent {...settingsProps} />
      </DiscoverySettingsPanel>
    </Box>
  );
};

const DiscoveryPage = () => {
  const { id: ocelId } = useCurrentOcel();

  const [panelWidth, setPanelWidth] = useState(() => loadPanelState().width);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(
    () => loadPanelState().collapsed,
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        PANEL_KEY,
        JSON.stringify({ width: panelWidth, collapsed: isPanelCollapsed }),
      );
    } catch {}
  }, [panelWidth, isPanelCollapsed]);

  if (!ocelId) return <LoadingOverlay visible />;

  return (
    <DiscoveryPageContent
      key={ocelId}
      ocelId={ocelId}
      panelWidth={panelWidth}
      setPanelWidth={setPanelWidth}
      isPanelCollapsed={isPanelCollapsed}
      setIsPanelCollapsed={setIsPanelCollapsed}
    />
  );
};

export default defineModuleRoute({
  component: DiscoveryPage,
  label: "Discovery",
  name: "discovery",
  requiresOcel: true,
});
