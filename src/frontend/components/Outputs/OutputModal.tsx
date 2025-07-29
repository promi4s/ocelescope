import { useOutput } from "@/api/fastapi/outputs/outputs";
import { ActionIcon, Box, Group, Modal, Stack, Title } from "@mantine/core";
import Viewer from "./Viewer";
import { XIcon } from "lucide-react";

const OutputModal: React.FC<{ id?: string; onClose: () => void }> = ({
  id,
  onClose,
}) => {
  const { data } = useOutput(id!, { query: { enabled: !!id } });

  return (
    data &&
    data.output.id && (
      <Modal
        opened={!!data}
        onClose={onClose}
        fullScreen
        styles={{ body: { height: "100%", overflow: "hidden" } }} // Ensure modal body is full height
        withCloseButton={false}
        transitionProps={{ transition: "fade", duration: 200 }}
        pos={"relative"}
      >
        <Stack w={"100%"} h={"100%"}>
          <Group justify="space-between">
            <Title size={"h5"}>{data.output.name}</Title>
            <ActionIcon variant={"subtle"} color="red" onClick={onClose}>
              <XIcon />
            </ActionIcon>
          </Group>
          <Box w={"100%"} h={"100%"} flex={1}>
            <Viewer id={data.output.id} />
          </Box>
        </Stack>
      </Modal>
    )
  );
};

export default OutputModal;
