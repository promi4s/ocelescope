import { PluginApi } from "@/api/fastapi-schemas";
import UploadModal from "@/components/UploadModal/UploadModal";
import { Card, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { PlusCircleIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export const PluginCard: React.FC<{ plugin: PluginApi }> = ({ plugin }) => {
  const { description, label } = plugin.meta;

  const tags = useMemo(() => {
    const extensions = plugin.methods.flatMap((method) =>
      Object.values(method.input_ocels ?? {}).map(({ extension }) => extension),
    );

    const inputResoures = plugin.methods.flatMap((method) =>
      Object.values(method.input_resources ?? {}).map(
        ([resourceName]) => resourceName,
      ),
    );

    const resultNames = plugin.methods.flatMap((method) =>
      (method.results ?? []).map((result) => {
        if (result.type === "resource") {
          return result.resource_type;
        }
      }),
    );
  }, [plugin.methods]);
  return (
    <Card
      component={Link}
      href={"/plugins"}
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      h={"100%"}
    >
      <Title size={"h4"} mb={"xs"}>
        {label}
      </Title>
      <Text size="sm" c="dimmed">
        {description}
      </Text>
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
