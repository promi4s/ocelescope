import { Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { PluginMethod, ResourceResult } from "@ocelescope/api-base";
import {
  useGetExtensionMeta,
  useGetPlugin,
  useGetResourceMeta,
} from "@ocelescope/api-base";
import { useRouter } from "next/router";
import { useMemo } from "react";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";
import { GenericCard } from "../components/PluginCard/GenericCard";

const MethodCard: React.FC<{ pluginId: string; method: PluginMethod }> = ({
  method,
}) => {
  const { query } = useRouter();

  const { data: resourceMeta = {} } = useGetResourceMeta();
  const { data: extensionMeta = {} } = useGetExtensionMeta();

  const tags = useMemo(() => {
    const extensions = Object.values(method.input_ocels ?? {}).map(
      ({ extension }) =>
        extension ? extensionMeta[extension]?.label : undefined,
    );

    const inputResoures = Object.values(method.input_resources ?? {}).map(
      ([resourceName]) => resourceMeta[resourceName]?.label ?? resourceName,
    );

    const resultNames = (method.results ?? [])
      .filter((result): result is ResourceResult => result.type === "resource")
      .map(
        (result) =>
          resourceMeta[result.resource_type]?.label ?? result.resource_type,
      );

    return Array.from(
      new Set([...inputResoures, ...resultNames, ...extensions]),
    ).filter((tag) => !!tag) as string[];
  }, [resourceMeta, extensionMeta, method]);

  return (
    <GenericCard
      title={method.label ?? method.name}
      description={method.description ?? ""}
      tags={tags}
      link={{
        href: {
          query: {
            ...query,
            methodName: method.name,
          },
        },
        children: "Run Method",
      }}
    />
  );
};

const PluginPage: React.FC<{ pluginId: string }> = ({ pluginId }) => {
  const { data: plugin } = useGetPlugin(pluginId);

  return (
    <Container fluid>
      <Stack>
        <Stack gap={0} align="center">
          <PluginBreadcrumbs />
          <Title mt={"xs"}> {plugin?.meta.label}</Title>
          <Text c="dimmed">{plugin?.meta.description}</Text>
        </Stack>
        <SimpleGrid
          cols={{ base: 1, sm: 2, lg: 4 }}
          spacing={{ base: 10, sm: "xl" }}
          verticalSpacing={{ base: "md", sm: "xl" }}
        >
          {plugin?.methods.map((method) => (
            <MethodCard
              method={method}
              key={method.name}
              pluginId={plugin.id}
            />
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
};

export default PluginPage;
