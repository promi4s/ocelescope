import {
  Group,
  LoadingOverlay,
  ScrollArea,
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

  if (!pluginMethod) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <PluginDashboard taskId={currentTask}>
      <ScrollArea h="100%" type="auto">
        <Stack gap="sm" p="md" maw={640} mx="auto" w="100%">
          <Group justify="center">
            <PluginBreadcrumbs />
          </Group>
          <Title ta="center">{pluginMethod.label ?? methodName}</Title>
          {pluginMethod.description && (
            <Text c="dimmed" ta="center">
              {pluginMethod.description}
            </Text>
          )}
          <PluginInput
            onSuccess={setCurrentTask}
            pluginId={pluginId}
            method={pluginMethod}
          />
        </Stack>
      </ScrollArea>
    </PluginDashboard>
  );
};

export default MethodPage;
