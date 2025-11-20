import type { PluginApi } from "@/api/fastapi-schemas";
import { useDeletePlugin } from "@/api/fastapi/plugins/plugins";
import { GenericCard } from "@/components/Cards/GenericCard";
import UploadModal from "@/components/UploadModal/UploadModal";
import { Card, Menu, Stack, Text, ThemeIcon } from "@mantine/core";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";

export const PluginCard: React.FC<{ plugin: PluginApi }> = ({ plugin }) => {
  const { description, label, version } = plugin.meta;

  const { mutate: deletePlugin } = useDeletePlugin();
  return (
    <GenericCard
      title={label}
      description={description ?? ""}
      version={version}
      menuItems={
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
      }
      cta={{ link: `plugins/${plugin.id}`, title: "View Plugin" }}
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
