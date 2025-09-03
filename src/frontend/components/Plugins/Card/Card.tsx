import { PluginApi } from "@/api/fastapi-schemas";
import { Card, Text } from "@mantine/core";
import Link from "next/link";

const PluginCard: React.FC<{ plugin: PluginApi }> = ({ plugin }) => {
  const { description, label } = plugin.meta;
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
      <Text fw={500} mb={"xs"}>
        {label}
      </Text>
      <Text size="sm" c="dimmed">
        {description}
      </Text>
    </Card>
  );
};

export default PluginCard;
