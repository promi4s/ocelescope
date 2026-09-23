import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Card,
  Divider,
  Group,
  Menu,
  Modal,
  OverflowList,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useHover } from "@mantine/hooks";
import { generateColor } from "@marko19907/string-to-color";
import type { PluginApi } from "@ocelescope/api-base";
import { useDeletePlugin } from "@ocelescope/api-base";
import { FullScreenUpload, getModuleRoute } from "@ocelescope/core";
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PluginUploadSection } from "../PluginUploadSection/PluginUploadSection";

export const PLUGIN_CARD_HEIGHT = 330;
const MAX_METHOD_LINKS = 3;
const INTERACTIVE_LAYER = { position: "relative", zIndex: 1 } as const;

export const PluginCard: React.FC<{ plugin: PluginApi }> = ({ plugin }) => {
  const { id, description, label, version, methods } = plugin;
  const { mutate: deletePlugin } = useDeletePlugin();
  const { hovered, ref } = useHover<HTMLDivElement>();

  const resourceTypes = Array.from(
    new Set(
      methods.flatMap((method) =>
        [...method.inputs, ...method.outputs].flatMap((io) =>
          io.type === "resource" ? [io.resource_label] : [],
        ),
      ),
    ),
  );

  const pluginHref = getModuleRoute({
    moduleName: "plugins",
    routeName: "plugins",
    query: { pluginId: id },
  });

  const visibleMethods = methods.slice(0, MAX_METHOD_LINKS);
  const hiddenCount = methods.length - visibleMethods.length;

  return (
    <Card
      ref={ref}
      withBorder
      shadow={hovered ? "md" : "xs"}
      radius="md"
      padding="md"
      h={PLUGIN_CARD_HEIGHT}
      style={{
        transition: "box-shadow 150ms ease, border-color 150ms ease",
        ...(hovered && { borderColor: "var(--mantine-primary-color-filled)" }),
      }}
    >
      <Box
        component={Link}
        href={pluginHref}
        aria-hidden
        tabIndex={-1}
        pos="absolute"
        inset={0}
      />
      <Group justify="space-between" align="start" wrap="nowrap" gap="sm">
        <Stack gap={0} miw={0}>
          <Anchor
            component={Link}
            href={pluginHref}
            fw={600}
            title={`Open ${label}`}
            style={INTERACTIVE_LAYER}
          >
            <Group gap={4} wrap="nowrap">
              <Text inherit truncate="end">
                {label}
              </Text>
              <ChevronRightIcon size={16} style={{ flexShrink: 0 }} />
            </Group>
          </Anchor>
          <Text size="xs" c="dimmed">
            v{version}
          </Text>
        </Stack>
        <Menu width={160} position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              style={INTERACTIVE_LAYER}
            >
              <EllipsisVerticalIcon size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<Trash2Icon size={14} />}
              color="red"
              onClick={() => deletePlugin({ pluginId: id })}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text
        size="sm"
        c="dimmed"
        mt="sm"
        lineClamp={2}
        h="calc(2em * var(--mantine-line-height-sm))"
      >
        {description || "No description provided."}
      </Text>

      <Divider
        my="sm"
        labelPosition="left"
        label={
          <Group gap={6}>
            <Text size="xs" fw={600} tt="uppercase">
              Methods
            </Text>
            <Badge size="xs" variant="light" color="gray" circle>
              {methods.length}
            </Badge>
          </Group>
        }
      />

      <Stack gap={4} flex={1}>
        {visibleMethods.length === 0 ? (
          <Text size="sm" c="dimmed">
            This plugin has no methods.
          </Text>
        ) : (
          visibleMethods.map((method) => (
            <UnstyledButton
              key={method.name}
              component={Link}
              href={getModuleRoute({
                moduleName: "plugins",
                routeName: "plugins",
                query: { pluginId: id, methodName: method.name },
              })}
              px="xs"
              py={6}
              style={{
                ...INTERACTIVE_LAYER,
                borderRadius: "var(--mantine-radius-sm)",
              }}
              bg="var(--mantine-color-default-hover)"
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" truncate="end" title={method.label}>
                  {method.label ?? method.name}
                </Text>
                <ChevronRightIcon
                  size={14}
                  style={{ flexShrink: 0, opacity: 0.6 }}
                />
              </Group>
            </UnstyledButton>
          ))
        )}
        {hiddenCount > 0 && (
          <Anchor
            component={Link}
            href={pluginHref}
            size="xs"
            mt={2}
            style={INTERACTIVE_LAYER}
          >
            +{hiddenCount} more {hiddenCount === 1 ? "method" : "methods"}
          </Anchor>
        )}
      </Stack>

      {resourceTypes.length > 0 && (
        <Stack gap={6} mt="sm">
          <Text size="xs" c="dimmed">
            Works with
          </Text>
          <OverflowList
            gap={6}
            h={20}
            data={resourceTypes}
            renderItem={(resourceType) => (
              <ResourceTypeBadge
                key={resourceType}
                resourceType={resourceType}
              />
            )}
            renderOverflow={(hiddenTypes) => (
              <Tooltip
                withArrow
                label={
                  <Stack gap={4}>
                    {hiddenTypes.map((resourceType) => (
                      <ResourceTypeBadge
                        key={resourceType}
                        resourceType={resourceType}
                      />
                    ))}
                  </Stack>
                }
              >
                <Badge
                  size="sm"
                  variant="default"
                  style={{ ...INTERACTIVE_LAYER, flexShrink: 0 }}
                >
                  +{hiddenTypes.length}
                </Badge>
              </Tooltip>
            )}
          />
        </Stack>
      )}
    </Card>
  );
};

const ResourceTypeBadge: React.FC<{ resourceType: string }> = ({
  resourceType,
}) => (
  <Badge
    size="sm"
    color={generateColor(resourceType)}
    style={{ flexShrink: 0 }}
  >
    {resourceType}
  </Badge>
);

export const UploadPluginCard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <FullScreenUpload
        active={!isModalOpen}
        accept={["application/x-zip-compressed", "application/zip"]}
        label="Drag'n'drop your Plugins to upload."
      />
      <Modal
        title={<Text size={"h3"}>Upload</Text>}
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size={"xl"}
      >
        <PluginUploadSection onSuccess={() => setIsModalOpen(false)} />
      </Modal>
      <Card
        component="button"
        radius="md"
        h={PLUGIN_CARD_HEIGHT}
        onClick={() => setIsModalOpen(true)}
        style={{
          cursor: "pointer",
          border: "2px dashed var(--mantine-color-default-border)",
          background: "transparent",
        }}
      >
        <Stack align="center" justify="center" h="100%" gap="xs">
          <ThemeIcon size={56} radius="xl" variant="light">
            <UploadIcon size={26} />
          </ThemeIcon>
          <Text fw={600}>Upload plugin</Text>
          <Text size="xs" c="dimmed">
            .zip archive — or drop it anywhere on this page
          </Text>
        </Stack>
      </Card>
    </>
  );
};
