import { PluginApi } from "@/api/fastapi-schemas";
import { useGetExtensionMeta } from "@/api/fastapi/ocels/ocels";
import { useDeletePlugin } from "@/api/fastapi/plugins/plugins";
import { useGetResourceMeta } from "@/api/fastapi/resources/resources";
import { GenericCard } from "@/components/Cards/GenericCard";
import UploadModal from "@/components/UploadModal/UploadModal";
import { Card, Menu, Stack, Text, ThemeIcon } from "@mantine/core";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { useMemo, useState } from "react";

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
    <GenericCard
      title={label}
      description={description ?? ""}
      version={version}
      tags={tags}
      menuItems={
        <>
          <Menu.Item
            leftSection={<Trash2Icon />}
            color="red.6"
            fw="bold"
            onClick={() => {
              deletePlugin({ pluginId: plugin.id });
            }}
          >
            Delete
          </Menu.Item>
        </>
      }
      cta={{ link: `plugins/${plugin.id}`, title: "Go To Plugin" }}
    />
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
