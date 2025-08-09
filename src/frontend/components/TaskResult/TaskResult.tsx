import useWaitForTask from "@/hooks/useTaskWaiter";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  LoadingOverlay,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import Viewer from "../Outputs/Viewer";
import { useOutput } from "@/api/fastapi/outputs/outputs";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import ResourceModal from "../Resources/ResourceModal";

type TaskResultProps = {
  taskId: string;
};

const OutputCard: React.FC<{ id: string; onView: () => void }> = ({
  id,
  onView,
}) => {
  const { data: output } = useOutput(id);

  return (
    output && (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Card.Section h={300}>
          <Viewer id={id} interactable={false} />
        </Card.Section>
        <Card.Section px={"md"}>
          <Group justify="space-between" mt="md" mb="xs">
            <Text fw={500}>{output.output.name}</Text>
            <Badge color="pink">{output.output.type_label}</Badge>
          </Group>
        </Card.Section>
        <Group mt="xs">
          <Button
            radius="md"
            style={{ flex: 1 }}
            onClick={onView}
            disabled={!output.visualization}
          >
            Inspect
          </Button>
          <ActionIcon
            variant="default"
            radius="md"
            size={36}
            component={"a"}
            href={`http://localhost:8000/outputs/${id}/download`}
          >
            <ThemeIcon variant="transparent">
              <DownloadIcon />
            </ThemeIcon>
          </ActionIcon>
        </Group>
      </Card>
    )
  );
};

const TaskResult: React.FC<TaskResultProps> = ({ taskId }) => {
  const { task } = useWaitForTask({ taskId });
  const [openedOutput, setOutput] = useState<undefined | string>(undefined);
  return (
    <>
      <Divider />
      <ResourceModal id={openedOutput} onClose={() => setOutput(undefined)} />
      <Stack pos={"relative"} gap={0} h={"100%"}>
        <LoadingOverlay visible={!task?.result} />
        <Title size={"h4"}>Results</Title>
        {task && (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {task &&
              task.result?.output_ids.map((id) => (
                <OutputCard id={id} onView={() => setOutput(id)} />
              ))}
          </SimpleGrid>
        )}
      </Stack>
    </>
  );
};

export default TaskResult;
