import { ActionIcon, Box, Group, Modal, Stack, Title } from "@mantine/core";
import Viewer from "./Viewer";
import { XIcon } from "lucide-react";
import { useResource } from "@/api/fastapi/resources/resources";

const ResourceModal: React.FC<{ id?: string; onClose: () => void }> = ({
  id,
  onClose,
}) => {
  const { data } = useResource(id!, { query: { enabled: !!id } });

  return (
    data &&
    data.resource.id && (
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
            <Title size={"h5"}>{data.resource.name}</Title>
            <ActionIcon variant={"subtle"} color="red" onClick={onClose}>
              <XIcon />
            </ActionIcon>
          </Group>
          <Box w={"100%"} h={"100%"} flex={1} mih={0}>
            <Viewer id={data.resource.id} />
          </Box>
        </Stack>
      </Modal>
    )
  );
};

export default ResourceModal;
