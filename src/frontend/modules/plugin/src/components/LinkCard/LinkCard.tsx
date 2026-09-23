import {
  Anchor,
  Badge,
  Box,
  Card,
  Group,
  OverflowList,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useHover } from "@mantine/hooks";
import { generateColor } from "@marko19907/string-to-color";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

type Href = ComponentProps<typeof Link>["href"];

export const INTERACTIVE_LAYER = { position: "relative", zIndex: 1 } as const;

export const LinkCard: React.FC<{
  href: Href;
  height: number;
  children: React.ReactNode;
}> = ({ href, height, children }) => {
  const { hovered, ref } = useHover<HTMLDivElement>();

  return (
    <Card
      ref={ref}
      withBorder
      shadow={hovered ? "md" : "xs"}
      radius="md"
      padding="md"
      h={height}
      style={{
        transition: "box-shadow 150ms ease, border-color 150ms ease",
        ...(hovered && { borderColor: "var(--mantine-primary-color-filled)" }),
      }}
    >
      <Box
        component={Link}
        href={href}
        aria-hidden
        tabIndex={-1}
        pos="absolute"
        inset={0}
      />
      {children}
    </Card>
  );
};

export const LinkCardTitle: React.FC<{ href: Href; label: string }> = ({
  href,
  label,
}) => (
  <Anchor
    component={Link}
    href={href}
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
);

export const LinkCardDescription: React.FC<{
  description?: string | null;
}> = ({ description }) => (
  <Text
    size="sm"
    c="dimmed"
    mt="sm"
    lineClamp={2}
    h="calc(2em * var(--mantine-line-height-sm))"
  >
    {description || "No description provided."}
  </Text>
);

export const ResourceTypeBadge: React.FC<{ resourceType: string }> = ({
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

export const ResourceTypeOverflowList: React.FC<{
  resourceTypes: string[];
  maxRows?: number;
}> = ({ resourceTypes, maxRows = 1 }) => (
  <OverflowList
    gap={6}
    maxRows={maxRows}
    data={resourceTypes}
    renderItem={(resourceType) => (
      <ResourceTypeBadge key={resourceType} resourceType={resourceType} />
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
);
