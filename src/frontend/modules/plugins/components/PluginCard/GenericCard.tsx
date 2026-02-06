import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import { EllipsisVertical } from "lucide-react";
import Link from "next/link";
import type React from "react";
import type { ComponentProps } from "react";
import uniqolor from "uniqolor";

export const GenericCard: React.FC<{
  title: string;
  description: string;
  version?: string;
  tags?: string[];
  menuItems?: React.ReactNode;
  link?: ComponentProps<typeof Link>;
}> = ({ menuItems, title, description, link, tags, version }) => {
  return (
    <Card shadow="sm" padding="sm" radius="md" withBorder h={"100%"}>
      <Group justify="space-between" align="start" wrap="nowrap">
        <Stack gap={"xs"} mb="xs">
          {tags && (
            <Group gap={"xs"}>
              {tags.map((tag) => (
                <Badge key={tag} size="sm" color={uniqolor(tag).color}>
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
          <Text fw={500}>
            {title}
            {version && (
              <Text ml="xs" c="dimmed" component="span">
                {`v${version}`}
              </Text>
            )}
          </Text>
        </Stack>
        {menuItems && (
          <Menu width={200} position="left">
            <Menu.Target>
              <ActionIcon variant="transparent" size={"sm"}>
                <EllipsisVertical />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>{menuItems}</Menu.Dropdown>
          </Menu>
        )}
      </Group>

      <Text size="sm" mb="xs" c="dimmed">
        {description}
      </Text>
      {link && (
        <Button mt="auto" component={Link} variant="outline" {...link} />
      )}
    </Card>
  );
};
