import { Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { type MethodApi, useGetPlugin } from "@ocelescope/api-base";
import { useRouter } from "next/router";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";
import { GenericCard } from "../components/PluginCard/GenericCard";

const MethodCard: React.FC<{ pluginId: string; method: MethodApi }> = ({
  method,
}) => {
  const { query } = useRouter();

  const tags = Array.from(
    new Set(
      [...method.inputs, ...method.outputs].map((io) =>
        io.type === "ocel" ? "OCEL" : io.resource_label,
      ),
    ),
  );

  return (
    <GenericCard
      title={method.label ?? method.name}
      description={method.description ?? ""}
      link={{
        href: {
          query: {
            ...query,
            methodName: method.name,
          },
        },
        children: "Run Method",
      }}
      tags={tags}
    />
  );
};

const PluginPage: React.FC<{ pluginId: string }> = ({ pluginId }) => {
  const { data: plugin } = useGetPlugin(pluginId);

  return (
    <Container fluid p="md">
      <Stack gap={0} align="center">
        <PluginBreadcrumbs />
        <Title mt={"xs"}> {plugin?.label}</Title>
        <Text c="dimmed">{plugin?.description}</Text>
      </Stack>
      <SimpleGrid
        cols={{ base: 1, sm: 2, lg: 4 }}
        spacing={{ base: 10, sm: "xl" }}
        verticalSpacing={{ base: "md", sm: "xl" }}
      >
        {plugin?.methods.map((method) => (
          <MethodCard method={method} key={method.name} pluginId={plugin.id} />
        ))}
      </SimpleGrid>
    </Container>
  );
};

export default PluginPage;
