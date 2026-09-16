import {
  ActionIcon,
  Alert,
  Box,
  Divider,
  Group,
  HoverCard,
  Menu,
  Modal,
  Paper,
  Popover,
  Stack,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import {
  CircleAlertIcon,
  DownloadIcon,
  FileImageIcon,
  FileType2Icon,
  InfoIcon,
  Maximize2Icon,
  RotateCcwIcon,
  SettingsIcon,
} from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

interface ChartHandle {
  exportImage: (
    format: "png" | "svg",
    filename: string,
    background: string,
  ) => void;
}
interface ChartSlot {
  register: (handle: ChartHandle | null) => void;
  setResettable: (reset: (() => void) | null) => void;
}
/** Private capability bridge; the card has no renderer dependency. */
export const ChartSlotContext = createContext<ChartSlot | null>(null);

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Help text behind an info icon, so the card header stays compact. */
  info?: ReactNode;

  /** Inline controls, e.g. a metric switch. */
  controls?: ReactNode;
  /** Rarely-used options, tucked into a popover. */
  settings?: ReactNode;
  /** Card-level actions, e.g. edit and remove. */
  actions?: ReactNode;
  /** Footnote under the chart, e.g. totals. */
  note?: ReactNode;

  error?: ReactNode;
  /** Base name for exported files. Defaults to a slug of the title. */
  filename?: string;
  /** Offer a fullscreen view. On by default. */
  expandable?: boolean;
  /** Offer PNG and SVG export. On by default. */
  exportable?: boolean;

  defaultSettingsOpen?: boolean;
  compact?: boolean;
  height?: number | string;
  expandedHeight?: number | string;

  /** A chart from this package. It registers itself with the card. */
  children: ReactNode;
}

const slugify = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Card chrome around a chart: title, help, settings, export, fullscreen and
 * error state. It reaches the chart through context rather than owning the
 * option, so charts stay usable on their own.
 */
export function ChartCard({
  title,
  subtitle,
  info,
  controls,
  settings,
  actions,
  note,
  error,
  filename,
  expandable = true,
  exportable = true,
  defaultSettingsOpen = false,
  compact = false,
  height = compact ? 220 : 320,
  expandedHeight = "70vh",
  children,
}: ChartCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(defaultSettingsOpen);
  const [expanded, setExpanded] = useState(false);
  const [reset, setReset] = useState<(() => void) | null>(null);

  const instanceRef = useRef<ChartHandle | null>(null);
  const theme = useMantineTheme();

  const slot = useMemo<ChartSlot>(
    () => ({
      register: (instance) => {
        instanceRef.current = instance;
      },
      // Stored as a thunk so React does not call the reset function itself.
      setResettable: (next) => setReset(() => next),
    }),
    [],
  );

  const exportChart = (format: "png" | "svg") =>
    instanceRef.current?.exportImage(
      format,
      filename ?? (slugify(title) || "chart"),
      theme.white,
    );

  const body = useCallback(
    (bodyHeight: number | string) =>
      error ? (
        <Alert
          color="red"
          variant="light"
          icon={<CircleAlertIcon size={16} />}
          h={bodyHeight}
        >
          <Text size="sm">{error}</Text>
        </Alert>
      ) : (
        <Box h={bodyHeight} miw={0}>
          {children}
        </Box>
      ),
    [children, error],
  );

  return (
    <ChartSlotContext.Provider value={slot}>
      <Paper withBorder p={compact ? "xs" : "lg"} radius="md" h="100%" miw={0}>
        <Stack gap={compact ? "xs" : "sm"} h="100%">
          <Group
            justify="space-between"
            align="flex-start"
            wrap="nowrap"
            gap="xs"
          >
            <Stack gap={2} miw={0}>
              <Text fw={600} size="sm" lh={1.4} lineClamp={2}>
                {title}
              </Text>
              {subtitle && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {subtitle}
                </Text>
              )}
            </Stack>

            <Group gap={4} wrap="nowrap" align="center">
              {controls}
              {controls && <Divider orientation="vertical" />}

              {reset && (
                <Tooltip label="Reset zoom" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Reset zoom"
                    onClick={reset}
                  >
                    <RotateCcwIcon size={14} />
                  </ActionIcon>
                </Tooltip>
              )}

              {settings && (
                <Popover
                  opened={settingsOpen}
                  onChange={setSettingsOpen}
                  position="bottom-end"
                  withArrow
                  shadow="md"
                  trapFocus={false}
                >
                  <Popover.Target>
                    <ActionIcon
                      variant={settingsOpen ? "light" : "subtle"}
                      color={settingsOpen ? "blue" : "gray"}
                      size="sm"
                      aria-label="Chart settings"
                      onClick={() => setSettingsOpen((value) => !value)}
                    >
                      <SettingsIcon size={14} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Stack gap="sm">
                      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                        Settings
                      </Text>
                      {settings}
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              )}

              {exportable && !error && (
                <Menu position="bottom-end" withArrow shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label="Download chart"
                    >
                      <DownloadIcon size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<FileImageIcon size={14} />}
                      onClick={() => exportChart("png")}
                    >
                      PNG
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<FileType2Icon size={14} />}
                      onClick={() => exportChart("svg")}
                    >
                      SVG
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}

              {expandable && !error && (
                <Tooltip label="Fullscreen" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Show chart fullscreen"
                    onClick={() => setExpanded(true)}
                  >
                    <Maximize2Icon size={14} />
                  </ActionIcon>
                </Tooltip>
              )}

              {actions}

              {info && (
                <HoverCard
                  width={340}
                  withArrow
                  shadow="md"
                  position="bottom-end"
                  openDelay={250}
                >
                  <HoverCard.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label="About this chart"
                    >
                      <InfoIcon size={14} />
                    </ActionIcon>
                  </HoverCard.Target>
                  <HoverCard.Dropdown>
                    {typeof info === "string" ? (
                      <Text size="sm">{info}</Text>
                    ) : (
                      info
                    )}
                  </HoverCard.Dropdown>
                </HoverCard>
              )}
            </Group>
          </Group>

          <Divider />
          {!expanded && body(height)}
          {note && (
            <Box
              pt="sm"
              style={{
                borderTop: "1px solid var(--mantine-color-default-border)",
              }}
            >
              {note}
            </Box>
          )}
        </Stack>
      </Paper>

      <Modal
        opened={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        size="90%"
        centered
      >
        {expanded && body(expandedHeight)}
      </Modal>
    </ChartSlotContext.Provider>
  );
}
