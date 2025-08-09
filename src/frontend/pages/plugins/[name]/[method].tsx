import { usePlugins, useRunPlugin } from "@/api/fastapi/plugins/plugins";
import PluginInput from "@/components/Plugins/Form";
import { Container, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/router";
import { useMemo } from "react";

const PluginPage = () => {
  const { data: plugins } = usePlugins();
  const router = useRouter();
  const { name, method } = router.query;

  const { mutate: runPlugin } = useRunPlugin();

  const pluginFormProps = useMemo(() => {
    const plugin = (plugins ?? []).find(
      ({ meta, methods }) =>
        meta.name === name && methods.some(({ name }) => name === method),
    );

    if (!plugin) return;

    const pluginMethod = plugin.methods.find(({ name }) => name === method)!;

    return {
      name: plugin.meta.name,
      version: plugin.meta.version,
      method: pluginMethod,
    };
  }, [plugins, name, method]);

  if (pluginFormProps === undefined) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <Container>
      <Stack gap={"md"}>
        <Stack gap={0}>
          <Title>{pluginFormProps.method.label}</Title>
          <Text>{pluginFormProps.method.description}</Text>
        </Stack>
        {pluginFormProps && (
          <PluginInput onSuccess={() => {}} {...pluginFormProps} />
        )}
      </Stack>
    </Container>
  );
};

export default PluginPage;
