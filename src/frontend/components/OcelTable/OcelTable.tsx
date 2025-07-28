import {
  useDeleteOcel,
  useGetOcels,
  useRenameOcel,
  useSetCurrentOcel,
} from "@/api/fastapi/ocels/ocels";
import OcelUpload from "@/components/OcelUpload/OcelUpload";
import {
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  EllipsisVerticalIcon,
  FileUp,
  Filter,
  Pencil,
  StarIcon,
  Trash,
  X,
} from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";

const OcelTable = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [deletedOcelId, setDeletedOcelId] = useState<
    { name: string; id: string } | undefined
  >(undefined);
  const { data: ocels, refetch } = useGetOcels({
    query: {
      refetchInterval: ({ state }) => {
        if (state.data && state.data.uploading_ocels.length > 0) {
          return 1000;
        }
        return false;
      },
    },
  });
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

  const { mutate: setCurrentOcel } = useSetCurrentOcel({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ refetchType: "all" });
      },
    },
  });

  const { mutateAsync: renameOcel } = useRenameOcel();

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
        <OcelUpload
          onUpload={async () => {
            await queryClient.invalidateQueries();
            setIsUploadModalOpen(false);
          }}
        />
      </Modal>
      <Stack gap={0}>
        <Title size={"h2"}>OCELS</Title>
        {ocels &&
        (ocels.ocels.length > 0 || ocels.uploading_ocels.length > 0) ? (
          <Table.ScrollContainer minWidth={800}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th />
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Uploaded At</Table.Th>
                  <Table.Th>Extensions</Table.Th>
                  <Table.Th
                    style={{ display: "flex", justifyContent: "end" }}
                    px={0}
                    align="right"
                  >
                    <Button
                      variant="subtle"
                      p={0}
                      w={30}
                      h={30}
                      onClick={() => setIsUploadModalOpen(true)}
                    >
                      <FileUp size={20} />
                    </Button>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(ocels.ocels ?? []).map(
                  ({ id, name, created_at, extensions }) => (
                    <Table.Tr
                      key={id}
                      onClick={() =>
                        setCurrentOcel({ params: { ocel_id: id } })
                      }
                    >
                      <Table.Td>
                        {id === ocels.current_ocel_id && (
                          <StarIcon size={14} fill="blue" color="blue" />
                        )}
                      </Table.Td>
                      <Table.Td align="center">
                        <Group>
                          {renamedOcel?.id !== id ? (
                            <>{name}</>
                          ) : (
                            <>
                              <TextInput
                                value={renamedOcel.value}
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
                      </Table.Td>
                      <Table.Td>{created_at}</Table.Td>
                      <Table.Td>{extensions}</Table.Td>
                      <Table.Td align="right" px={0}>
                        <Menu width={200} position="left-start">
                          <Menu.Target>
                            <Button
                              p={0}
                              variant="subtle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <EllipsisVerticalIcon />
                            </Button>
                          </Menu.Target>

                          <Menu.Dropdown>
                            <Menu.Item
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamedOcel({ id, value: name });
                              }}
                              leftSection={<Pencil size={16} />}
                            >
                              Rename
                            </Menu.Item>
                            <Menu.Item
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/filter/${id}`);
                              }}
                              leftSection={<Filter size={16} />}
                            >
                              Filter
                            </Menu.Item>
                            <Menu.Sub>
                              <Menu.Sub.Target>
                                <Menu.Sub.Item
                                  leftSection={<Download size={16} />}
                                >
                                  Download
                                </Menu.Sub.Item>
                              </Menu.Sub.Target>

                              <Menu.Sub.Dropdown>
                                {[".xml", ".sqlite", ".json"].map((ext) => (
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
                      </Table.Td>
                    </Table.Tr>
                  ),
                )}
                {(ocels.uploading_ocels ?? []).map(({ name, uploaded_at }) => (
                  <Table.Tr>
                    <Table.Td>
                      <Loader size={14} />
                    </Table.Td>
                    <Table.Td>{name}</Table.Td>
                    <Table.Td>{uploaded_at}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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
          </Table.ScrollContainer>
        ) : (
          <OcelUpload
            onUpload={async () =>
              queryClient.invalidateQueries({ refetchType: "all" })
            }
          />
        )}
      </Stack>
    </>
  );
};

export default OcelTable;
