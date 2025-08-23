import { useGetPluginMethod } from "@/api/fastapi/plugins/plugins";
import PluginInput from "@/components/Plugins/Form";
import ResultSection from "@/components/Plugins/ResultSection/ResultSection";
import { Container, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const PluginPage = () => {
  const router = useRouter();
  const { id, method } = router.query;

  const { data: pluginMethod, isLoading } = useGetPluginMethod(
    id as string,
    method as string,
  );

  useEffect(() => {
    if (!pluginMethod && !isLoading) {
      router.push("/plugins");
    }
  }, [isLoading, pluginMethod]);

  const [currentTask, setCurrentTask] = useState<string>();

  if (!pluginMethod) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <Container>
      <Stack gap={"xl"}>
        <Stack gap={0}>
          <Title>{pluginMethod?.label ?? method}</Title>
          {pluginMethod?.description && (
            <Text>{pluginMethod?.description}</Text>
          )}
        </Stack>
        <PluginInput
          onSuccess={setCurrentTask}
          pluginId={id as string}
          method={pluginMethod}
        />
        <ResultSection taskId={currentTask} />
      </Stack>
    </Container>
  );
};

export default PluginPage;
