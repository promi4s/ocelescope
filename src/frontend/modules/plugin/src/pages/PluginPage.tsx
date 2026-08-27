import {
  Container,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import type { PluginMethod, ResourceResult } from "@ocelescope/api-base";
import {
  useDisableDiscoveryMethod,
  useEnableDiscoveryMethod,
  useGetPlugin,
  useGetResourceMeta,
  useListDiscoveryMethods,
} from "@ocelescope/api-base";
import { useInvalidate } from "@ocelescope/core";
import { useRouter } from "next/router";
import { useMemo } from "react";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";
import { GenericCard } from "../components/PluginCard/GenericCard";

const MethodCard: React.FC<{ pluginId: string; method: PluginMethod }> = ({
  method,
}) => {
  const { query } = useRouter();

  const { data: resourceMeta = {} } = useGetResourceMeta();

  const tags = useMemo(() => {
    const inputResources = Object.values(method.input_resources ?? {}).map(
      ([resourceName]) => resourceMeta[resourceName]?.label ?? resourceName,
    );

    const resultNames = (method.results ?? [])
      .filter((result): result is ResourceResult => result.type === "resource")
      .map(
        (result) =>
          resourceMeta[result.resource_type]?.label ?? result.resource_type,
      );

    return Array.from(new Set([...inputResources, ...resultNames]));
  }, [resourceMeta, method]);

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
  const { data: allMethods = [] } = useListDiscoveryMethods();
  const invalidate = useInvalidate();
  const onSuccess = () => invalidate(["discoveryMethods"]);
  const { mutate: disableMethod } = useDisableDiscoveryMethod({
    mutation: { onSuccess },
  });
  const { mutate: enableMethod } = useEnableDiscoveryMethod({
    mutation: { onSuccess },
  });

  const discoveryMethods = useMemo(
    () =>
      allMethods.flatMap((meta) =>
        meta.variants
          .filter((v) => v.pluginId === pluginId)
          .map((v) => ({ name: meta.name, variant: v })),
      ),
    [allMethods, pluginId],
  );

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

        {discoveryMethods.length > 0 && (
          <>
            <Divider />
            <Stack gap="xs">
              <Title order={4}>Discovery Methods</Title>
              {discoveryMethods.map(({ name, variant }) => (
                <Group key={variant.methodId} justify="space-between">
                  <Stack gap={0}>
                    <Text fw={500}>{name}</Text>
                    {variant.description && (
                      <Text size="sm" c="dimmed">
                        {variant.description}
                      </Text>
                    )}
                  </Stack>
                  <Switch
                    label="Active in Discovery"
                    checked={variant.enabled ?? true}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        enableMethod({ methodId: variant.methodId });
                      } else {
                        disableMethod({ methodId: variant.methodId });
                      }
                    }}
                  />
                </Group>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
};

export default PluginPage;
