import { PluginApi } from "@/api/fastapi-schemas";
import { useGetExtensionMeta } from "@/api/fastapi/ocels/ocels";
import { useDeletePlugin } from "@/api/fastapi/plugins/plugins";
import { useGetResourceMeta } from "@/api/fastapi/resources/resources";
import UploadModal from "@/components/UploadModal/UploadModal";
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Menu,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { EllipsisVerticalIcon, Trash2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import uniqolor from "uniqolor";

export const PluginCard: React.FC<{ plugin: PluginApi }> = ({ plugin }) => {
  const { description, label, version } = plugin.meta;

  const { data: resourceMeta = {} } = useGetResourceMeta();
  const { data: extensionMeta = {} } = useGetExtensionMeta();
  const { mutate: deletePlugin } = useDeletePlugin();

  const tags = useMemo(() => {
    const extensions = plugin.methods.flatMap((method) =>
      Object.values(method.input_ocels ?? {}).map(({ extension }) =>
        extension ? extensionMeta[extension]?.label : undefined,
      ),
    );

    const inputResoures = plugin.methods.flatMap((method) =>
      Object.values(method.input_resources ?? {}).map(
        ([resourceName]) => resourceMeta[resourceName]?.label ?? resourceName,
      ),
    );

    const resultNames = plugin.methods.flatMap((method) =>
      (method.results ?? []).map((result) => {
        if (result.type === "resource") {
          return (
            resourceMeta[result.resource_type]?.label ?? result.resource_type
          );
        }
      }),
    );

    return Array.from(
      new Set([...inputResoures, ...resultNames, ...extensions]),
    ).filter((tag) => !!tag) as string[];
  }, [plugin.methods, resourceMeta, extensionMeta]);

  return (
    <Card
      component={Link}
      href={`/plugins/${plugin.id}`}
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      h={"100%"}
    >
      <Stack justify="space-between" h="100%">
        <Stack gap={"sm"}>
          <Group align="center" justify="space-between">
            <Title size={"h4"}>{`${label} v${version}`}</Title>
            <Menu width={200} position="left">
              <Menu.Target>
                <ActionIcon
                  variant="transparent"
                  onClick={(e) => e.preventDefault()}
                >
                  <EllipsisVerticalIcon size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Trash2Icon size={18} />}
                  color="red.6"
                  fw={"bold"}
                  onClick={(e) => {
                    e.preventDefault();
                    deletePlugin({ pluginId: plugin.id });
                  }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Stack>
        <Group gap={"xs"}>
          {tags.map((tag) => (
            <Badge color={uniqolor(tag).color}>{tag}</Badge>
          ))}
        </Group>
      </Stack>
    </Card>
  );
};

export const UploadPluginCard: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        acceptedTypes={["plugin"]}
      />
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        h={"100%"}
        onClick={() => setIsModalOpen(true)}
        style={{ cursor: "pointer" }}
      >
        <Stack align="center" justify="center" h={"100%"}>
          <ThemeIcon size={"xl"} variant="transparent">
            <UploadIcon size={50} />
          </ThemeIcon>
          <Text fw="bold" c={"blue.6"}>
            Upload Plugin
          </Text>
        </Stack>
      </Card>
    </>
  );
};
