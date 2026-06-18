import { Card, Menu, Modal, Stack, Text, ThemeIcon } from "@mantine/core";
import type { PluginApi } from "@ocelescope/api-base";
import { useDeletePlugin } from "@ocelescope/api-base";
import { getModuleRoute } from "@ocelescope/core";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { PluginUploadSection } from "../PluginUploadSection/PluginUploadSection";
import { GenericCard } from "./GenericCard";

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
      link={{
        href: getModuleRoute({
          routeName: "plugins",
          moduleName: "plugins",
          query: { pluginId: plugin.id },
        }),
        children: "View Plugin",
      }}
    />
  );
};

export const UploadPluginCard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Modal
        title={<Text size={"h3"}>Upload</Text>}
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size={"xl"}
      >
        <PluginUploadSection onSuccess={() => setIsModalOpen(false)} />
      </Modal>
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
