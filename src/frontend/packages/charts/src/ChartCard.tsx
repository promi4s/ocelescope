import {
  ActionIcon,
  Box,
  Divider,
  Group,
  HoverCard,
  Paper,
  Popover,
  Stack,
  Text,
} from "@mantine/core";
import { InfoIcon, SettingsIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  info?: ReactNode;

  controls?: ReactNode;
  settings?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;

  defaultSettingsOpen?: boolean;
  compact?: boolean;
  height?: number | string;

  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  info,
  controls,
  settings,
  actions,
  note,
  defaultSettingsOpen = false,
  compact = false,
  height = compact ? 220 : 320,
  children,
}: ChartCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(defaultSettingsOpen);

  return (
    <Paper withBorder p={compact ? "xs" : "md"} radius="md" h="100%">
      <Stack gap={compact ? "xs" : "sm"} h="100%">
        <Group
          justify="space-between"
          align="flex-start"
          wrap="nowrap"
          gap="xs"
        >
          <Stack gap={2} miw={0}>
            <Text fw={600} size={compact ? "sm" : "md"} lh={1.3} truncate>
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

            {controls && (settings || actions || info) && (
              <Divider orientation="vertical" />
            )}

            {settings && (
              <Popover
                opened={settingsOpen}
                onChange={setSettingsOpen}
                position="bottom-end"
                withArrow
                shadow="md"
                closeOnClickOutside
                closeOnEscape
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
                    <Text
                      size="xs"
                      fw={600}
                      c="dimmed"
                      tt="uppercase"
                      lts={0.5}
                    >
                      Settings
                    </Text>
                    {settings}
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            )}

            {actions}

            {info && (
              <HoverCard
                width={340}
                withArrow
                shadow="md"
                position="bottom-end"
                openDelay={250}
                closeDelay={100}
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

        <Box h={height} miw={0}>
          {children}
        </Box>

        {note}
      </Stack>
    </Paper>
  );
}
