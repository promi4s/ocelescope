import {
  Group,
  LoadingOverlay,
  Spoiler,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useGetPluginMethod } from "@ocelescope/api-base";
import { PluginDashboard } from "@ocelescope/plugin-components";
import { useState } from "react";
import PluginInput from "../components/Form";
import PluginBreadcrumbs from "../components/PluginBreadcrumbs/PluginBreadcrumbs";

const MethodPage: React.FC<{ pluginId: string; methodName: string }> = ({
  pluginId,
  methodName,
}) => {
  const { data: pluginMethod } = useGetPluginMethod(pluginId, methodName);

  const [currentTask, setCurrentTask] = useState<string>();

  const [autoShowFirstOutput, setAutoShowFirstOutput] = useState(true);

  if (!pluginMethod) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <PluginDashboard
      taskId={currentTask}
      autoShowFirstOutput={autoShowFirstOutput}
    >
      <Stack h="100%" gap={0}>
        <Stack gap="sm" p="md" maw={640} mx="auto" w="100%">
          <Group justify="center">
            <PluginBreadcrumbs />
          </Group>
          <Title ta="center" order={2}>
            {pluginMethod.label ?? methodName}
          </Title>
          {pluginMethod.description && (
            <Spoiler maxHeight={120} showLabel="Show more" hideLabel="Hide">
              <Text c="dimmed" ta="center">
                {pluginMethod.description}
              </Text>
            </Spoiler>
          )}
        </Stack>
        <PluginInput
          onSuccess={setCurrentTask}
          pluginId={pluginId}
          method={pluginMethod}
          autoShowFirstOutput={autoShowFirstOutput}
          setAutoShowFirstOutput={setAutoShowFirstOutput}
        />
      </Stack>
    </PluginDashboard>
  );
};

export default MethodPage;
