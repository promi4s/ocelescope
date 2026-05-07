import {
  ActionIcon,
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
  Tooltip,
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
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PANEL_MIN = 240;
const PANEL_MAX = 600;
const PANEL_DEFAULT = 320;
const PANEL_KEY = "ocelescope:discovery:panel";

const getSettingsKey = (ocelId: string) =>
  `ocelescope:discovery:settings:${ocelId}`;

// ─── Persistence helpers ──────────────────────────────────────────────────────

type PanelState = { width: number; collapsed: boolean };

const loadPanelState = (): PanelState => {
  try {
    const stored = localStorage.getItem(PANEL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PanelState>;
      return {
        width: parsed.width ?? PANEL_DEFAULT,
        collapsed: parsed.collapsed ?? false,
      };
    }
  } catch {}
  return { width: PANEL_DEFAULT, collapsed: false };
};

type DiscoveryResourceType = DiscoveryMethodMeta["resourceType"];

type StoredSettings = {
  selectedMethodType?: DiscoveryResourceType | null;
  formDataByMethod?: Partial<
    Record<DiscoveryResourceType, Record<string, unknown>>
  >;
};

const loadStoredSettings = (ocelId: string): StoredSettings => {
  try {
    const stored = localStorage.getItem(getSettingsKey(ocelId));
    if (stored) return JSON.parse(stored) as StoredSettings;
  } catch {}
  return {};
};

// ─── Schema types ─────────────────────────────────────────────────────────────

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
  ["x-ui-meta"]?: { field_type?: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTargetLabel = (resourceType: DiscoveryResourceType) =>
  resourceType === "DirectlyFollowsGraph" ? "DFG" : "Petri Net";

const getInitialFormData = (schema: DiscoverySchema | undefined) => {
  const initial: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema?.properties ?? {})) {
    if (property.default !== undefined) {
      initial[name] = property.default;
      continue;
    }
    if (property.type === "array") initial[name] = [];
  }
  return initial;
};

const normalizeFormData = (formData: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(formData).filter(([_, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );

// ─── Field renderer ───────────────────────────────────────────────────────────

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

// ─── Settings fields ──────────────────────────────────────────────────────────

const DiscoverySettingsContent = ({
  methods,
  selectedMethodType,
  setSelectedMethodType,
  selectedMethod,
  selectedSchema,
  activeFormData,
  setFormDataByMethod,
  eventCounts,
  objectCounts,
  errorMessage,
}: {
  methods: DiscoveryMethodMeta[];
  selectedMethodType: DiscoveryResourceType | null;
  setSelectedMethodType: (v: DiscoveryResourceType | null) => void;
  selectedMethod: DiscoveryMethodMeta | null;
  selectedSchema: DiscoverySchema;
  activeFormData: Record<string, unknown>;
  setFormDataByMethod: React.Dispatch<
    React.SetStateAction<
      Partial<Record<DiscoveryResourceType, Record<string, unknown>>>
    >
  >;
  eventCounts: Record<string, unknown>;
  objectCounts: Record<string, unknown>;
  errorMessage: string | undefined;
}) => (
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
    {Object.entries(selectedSchema.properties ?? {}).map(([name, property]) => (
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
                  current[selectedMethodType as DiscoveryResourceType]) ??
                  {}),
                [name]: value,
              },
            })),
        })}
      </Box>
    ))}
    {errorMessage && (
      <Alert color="red" title="Discovery failed">
        {errorMessage}
      </Alert>
    )}
  </Stack>
);

// ─── Inner component (keyed by ocelId for correct lazy init) ──────────────────

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
  // Lazily initialize from localStorage — runs once at mount since key={ocelId}
  const initialSettings = loadStoredSettings(ocelId);

  const [selectedMethodType, setSelectedMethodType] =
    useState<DiscoveryResourceType | null>(
      initialSettings.selectedMethodType ?? null,
    );
  const [formDataByMethod, setFormDataByMethod] = useState<
    Partial<Record<DiscoveryResourceType, Record<string, unknown>>>
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
        JSON.stringify({ selectedMethodType, formDataByMethod }),
      );
    } catch {}
  }, [ocelId, selectedMethodType, formDataByMethod]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setPanelWidth(
        Math.max(PANEL_MIN, Math.min(PANEL_MAX, dragRef.current.startWidth + delta)),
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
  } = useGetDiscoveryMeta();

  const { data: eventCounts = {} } = useEventCounts(ocelId, undefined, {
    query: { enabled: true },
  });
  const { data: objectCounts = {} } = useObjectCounts(ocelId, undefined, {
    query: { enabled: true },
  });

  // Auto-select first method only if nothing was restored
  useEffect(() => {
    if (selectedMethodType || methods.length === 0) return;
    setSelectedMethodType(
      methods.find((m) => m.resourceType === "DirectlyFollowsGraph")
        ?.resourceType ??
        methods[0]?.resourceType ??
        null,
    );
  }, [methods, selectedMethodType]);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.resourceType === selectedMethodType) ?? null,
    [methods, selectedMethodType],
  );

  const selectedSchema = (selectedMethod?.inputSchema ?? {}) as DiscoverySchema;

  // Initialize form data defaults when a method is first selected
  useEffect(() => {
    if (!selectedMethodType || !selectedMethod) return;
    setFormDataByMethod((current) => {
      if (current[selectedMethodType]) return current;
      return { ...current, [selectedMethodType]: getInitialFormData(selectedSchema) };
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
        )
          return 1000;
        return false;
      },
    },
  });

  useEffect(() => {
    const resourceId = task?.output.resource_ids?.at(-1);
    if (task?.state === "SUCCESS" && resourceId) setLatestResourceId(resourceId);
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
    if (!selectedMethodType) return;
    const timeoutId = window.setTimeout(() => {
      if (selectedMethodType === "PetriNet") {
        discoverPetriNet({ ocelId, data: requestPayload as DiscoverPetriNetBody });
        return;
      }
      discoverDirectlyFollowsGraph({
        ocelId,
        data: requestPayload as DiscoverDFGBody,
      });
    }, 650);
    return () => window.clearTimeout(timeoutId);
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
    (task?.state === "FAILURE" ? "The backend discovery task failed." : undefined);

  const settingsProps = {
    methods,
    selectedMethodType,
    setSelectedMethodType,
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

      {/* Right panel — single wrapper ensures border spans full height */}
      <Box
          style={{
            borderLeft: "1px solid var(--mantine-color-default-border)",
            display: "flex",
            flexDirection: "row",
            flexShrink: 0,
            width: isPanelCollapsed ? 36 : undefined,
          }}
        >
          {isPanelCollapsed ? (
            /* Collapsed strip */
            <Tooltip label="Expand settings" position="left" withArrow>
              <Box
                style={{
                  width: 36,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: 10,
                  cursor: "pointer",
                }}
                onClick={() => setIsPanelCollapsed(false)}
              >
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <ChevronsLeft size={15} />
                </ActionIcon>
              </Box>
            </Tooltip>
          ) : (
            <>
              {/* Drag handle with embedded collapse tab */}
              <Box
                style={{
                  width: 12,
                  flexShrink: 0,
                  position: "relative",
                  cursor: "col-resize",
                }}
                onMouseDown={handleResizeStart}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--mantine-color-default-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                <Tooltip label="Collapse settings" position="left" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="default"
                    radius="xl"
                    style={{
                      position: "absolute",
                      top: 10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 1,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setIsPanelCollapsed(true)}
                  >
                    <ChevronsRight size={12} />
                  </ActionIcon>
                </Tooltip>
              </Box>

              {/* Settings content */}
              <Box
                style={{
                  width: panelWidth,
                  flexShrink: 0,
                  overflowY: "auto",
                }}
                p="lg"
              >
                <DiscoverySettingsContent {...settingsProps} />
              </Box>
            </>
          )}
        </Box>
    </Box>
  );
};

// ─── Outer shell — owns panel state, renders inner with key={ocelId} ──────────

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
