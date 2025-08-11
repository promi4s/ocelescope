import { usePlugins } from "@/api/fastapi/plugins/plugins";
import PluginInput from "@/components/Plugins/Form";
import ResultSection from "@/components/Plugins/ResultSection/ResultSection";
import { Container, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

const PluginPage = () => {
  const { data: plugins } = usePlugins();
  const router = useRouter();
  const { name, method } = router.query;

  const [currentTask, setCurrentTask] = useState<string>();

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
      <Stack gap={"xl"}>
        <Stack gap={0}>
          <Title>{pluginFormProps.method.label}</Title>
          <Text>{pluginFormProps.method.description}</Text>
        </Stack>
        {pluginFormProps && (
          <PluginInput onSuccess={setCurrentTask} {...pluginFormProps} />
        )}
        <ResultSection taskId={currentTask} />
      </Stack>
    </Container>
  );
};

export default PluginPage;
