import { PluginMethod } from "@/api/fastapi-schemas";
import { useGetExtensionMeta } from "@/api/fastapi/ocels/ocels";
import { useGetPlugin } from "@/api/fastapi/plugins/plugins";
import { useGetResourceMeta } from "@/api/fastapi/resources/resources";
import { GenericCard } from "@/components/Cards/GenericCard";
import {
  Anchor,
  Breadcrumbs,
  Container,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

const MethodCard: React.FC<{ pluginId: string; method: PluginMethod }> = ({
  method,
  pluginId,
}) => {
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

    const resultNames = (method.results ?? []).map((result) => {
      if (result.type === "resource") {
        return (
          resourceMeta[result.resource_type]?.label ?? result.resource_type
        );
      }
    });

    return Array.from(
      new Set([...inputResoures, ...resultNames, ...extensions]),
    ).filter((tag) => !!tag) as string[];
  }, [resourceMeta, extensionMeta]);

  return (
    <GenericCard
      title={method.label ?? method.name}
      description={method.description ?? ""}
      tags={tags}
      cta={{ link: `/plugins/${pluginId}/${method.name}`, title: "Run Method" }}
    />
  );
};

const PluginPage: React.FC = () => {
  const router = useRouter();

  const { id } = router.query;

  const { data: plugin } = useGetPlugin(id as string);
  return (
    <Container fluid>
      <Stack>
        <Stack gap={0} align="center">
          <Breadcrumbs>
            {[
              <Anchor component={Link} href="/plugins">
                Plugins
              </Anchor>,
              <Anchor component={Link} href={`/plugins/${plugin?.id}`}>
                {plugin?.meta.label}
              </Anchor>,
            ]}
          </Breadcrumbs>
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
