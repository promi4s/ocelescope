import { OcelMetadata } from "@/api/fastapi-schemas";
import {
  useDeleteOcel,
  useGetOcels,
  useRenameOcel,
} from "@/api/fastapi/ocels/ocels";
import { useGetSystemTasks } from "@/api/fastapi/tasks/tasks";
import OcelUpload from "@/components/OcelUpload/OcelUpload";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  EllipsisVerticalIcon,
  FileUpIcon,
  Filter,
  Pencil,
  Trash,
  X,
} from "lucide-react";
import { DataTable } from "mantine-datatable";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";

const OcelTable = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [deletedOcelId, setDeletedOcelId] = useState<
    { name: string; id: string } | undefined
  >(undefined);
  const { data: ocels, isLoading, refetch } = useGetOcels();

  const { data: uploadingOcel } = useGetSystemTasks(
    {
      task_name: "importOcel",
      only_running: true,
    },
    {
      query: {
        refetchInterval: ({ state }) => {
          if (state.data && state.data.length > 0) {
            return 1000;
          }
          return false;
        },
      },
    },
  );

  const isOcel = useCallback(
    (id: string) => ocels?.some(({ id: ocelId }) => ocelId === id),
    [ocels],
  );

  const { mutate: deleteOcel } = useDeleteOcel({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ refetchType: "all" });
      },
    },
  });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [renamedOcel, setRenamedOcel] = useState<
    { id: string; value: string } | undefined
  >(undefined);

  const { mutateAsync: renameOcel } = useRenameOcel();

  const isOcelUploaded =
    (uploadingOcel && uploadingOcel.length > 0) || (ocels && ocels.length > 0);

  return (
    <>
      <Modal
        opened={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        size={"xl"}
        withCloseButton={false}
        styles={{
          content: {
            backgroundColor: "transparent", // removes background
            boxShadow: "none", // optional: removes drop shadow
          },
        }}
      >
        <Paper
          withBorder
          pos={"relative"}
          shadow="sm"
          p={22}
          m={30}
          radius={"md"}
        >
          <OcelUpload
            onUpload={async () => {
              await queryClient.invalidateQueries();
              setIsUploadModalOpen(false);
            }}
          />
        </Paper>
      </Modal>
      <Modal
        opened={!!deletedOcelId}
        onClose={() => setDeletedOcelId(undefined)}
        title={`Delete ${deletedOcelId?.name}`}
      >
        <Text>
          Are you sure you want to delete this ocel? This action cannot be
          undone.
        </Text>
        <Group>
          <Button
            mt={"md"}
            onClick={() => {
              deleteOcel({ params: { ocel_id: deletedOcelId!.id } });
              setDeletedOcelId(undefined);
            }}
            color={"red"}
          >
            Delete
          </Button>
        </Group>
      </Modal>
      <Stack gap={0}>
        <Title size={"h3"}>OCELS</Title>
        <DataTable
          height={!isOcelUploaded ? 500 : undefined}
          withTableBorder
          borderRadius={"md"}
          highlightOnHover
          columns={[
            {
              accessor: "name",
              render: ({ name, id }) => {
                return (
                  <Group>
                    {renamedOcel?.id !== id ? (
                      <>{name}</>
                    ) : (
                      <>
                        <TextInput
                          value={renamedOcel.value}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(newName) =>
                            setRenamedOcel({
                              id,
                              value: newName.currentTarget.value,
                            })
                          }
                        />
                        <Button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await renameOcel({
                              params: {
                                ocel_id: renamedOcel.id,
                                new_name: renamedOcel.value,
                              },
                            });
                            setRenamedOcel(undefined);
                            await refetch();
                          }}
                          size={"xs"}
                          color="green"
                        >
                          <Check size={16} />
                        </Button>
                        <Button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setRenamedOcel(undefined);
                          }}
                          size={"xs"}
                          color="red"
                        >
                          <X size={16} />
                        </Button>
                      </>
                    )}
                  </Group>
                );
              },
            },
            { accessor: "created_at" },
            {
              accessor: "extensions",
              render: ({ extensions }) =>
                extensions.map(({ label }) => label).join(","),
            },
            {
              title: (
                <ActionIcon
                  variant="subtle"
                  size={"sm"}
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <FileUpIcon size={16} />
                </ActionIcon>
              ),
              textAlign: "right",
              accessor: "actions",
              width: "0%",
              render: ({ id, name }) => {
                return (
                  isOcel(id) && (
                    <Menu width={200} position="left-start">
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EllipsisVerticalIcon size={20} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <Menu.Item
                          onClick={() => {
                            setRenamedOcel({ id, value: name });
                          }}
                          leftSection={<Pencil size={16} />}
                        >
                          Rename
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            router.push(`/filter/${id}`);
                          }}
                          leftSection={<Filter size={16} />}
                        >
                          Filter
                        </Menu.Item>
                        <Menu.Sub>
                          <Menu.Sub.Target>
                            <Menu.Sub.Item leftSection={<Download size={16} />}>
                              Download
                            </Menu.Sub.Item>
                          </Menu.Sub.Target>

                          <Menu.Sub.Dropdown>
                            {[".xmlocel", ".sqlite", ".jsonocel"].map((ext) => (
                              <Menu.Item
                                component={"a"}
                                href={`http://localhost:8000/ocels/download?ext=${ext}&ocel_id=${id}`}
                              >
                                {ext}
                              </Menu.Item>
                            ))}
                          </Menu.Sub.Dropdown>
                        </Menu.Sub>
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<Trash size={16} color={"red"} />}
                          color="red"
                          fw="bold"
                          onClick={() => setDeletedOcelId({ id, name })}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )
                );
              },
            },
          ]}
          emptyState={
            !isOcelUploaded ? (
              <Box p={"md"} w={"100%"} style={{ pointerEvents: "auto" }}>
                <OcelUpload
                  onUpload={async () =>
                    queryClient.invalidateQueries({ refetchType: "all" })
                  }
                />
              </Box>
            ) : isLoading ? (
              <LoadingOverlay />
            ) : undefined
          }
          records={
            [
              ...(ocels ?? []),
              ...(uploadingOcel ?? []).map(({ id, metadata }) => ({
                id,
                name: metadata["fileName"] as string,
                created_at: metadata["uploaded_at"] as string,
                extensions: [],
              })),
            ] as OcelMetadata[]
          }
        />
      </Stack>
    </>
  );
};

export default OcelTable;
