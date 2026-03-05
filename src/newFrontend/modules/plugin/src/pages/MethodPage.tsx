import { Container, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useGetPluginMethod } from "@ocelescope/api-base";
import { useState } from "react";
import PluginInput from "../components/Form";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";
import ResultSection from "../components/ResultSection/ResultSection";

const MethodPage: React.FC<{ pluginId: string; methodName: string }> = ({
  pluginId,
  methodName,
}) => {
  const { data: pluginMethod } = useGetPluginMethod(pluginId, methodName);

  const [currentTask, setCurrentTask] = useState<string>();

  if (!pluginMethod) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <Container>
      <Stack gap={"xl"}>
        <Stack align="center">
          <PluginBreadcrumbs />
          <Stack gap={"sm"}>
            <Title ta={"center"}>{pluginMethod?.label ?? methodName}</Title>
            {pluginMethod?.description && (
              <Text c="dimmed">{pluginMethod?.description}</Text>
            )}
          </Stack>
        </Stack>
        <PluginInput
          onSuccess={setCurrentTask}
          pluginId={pluginId}
          method={pluginMethod}
        />
        {currentTask && <ResultSection taskId={currentTask} />}
      </Stack>
    </Container>
  );
};

export default MethodPage;
