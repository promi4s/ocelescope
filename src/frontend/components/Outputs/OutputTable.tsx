import {
  useDeleteOutput,
  useOutputs,
  useUploadOutput,
} from "@/api/fastapi/outputs/outputs";
import { Stack, ActionIcon, Title, Menu } from "@mantine/core";
import { Download, EllipsisVerticalIcon, Trash } from "lucide-react";
import { DataTable } from "mantine-datatable";
import dayjs from "dayjs";
import Viewer from "./Viewer";
import FileUploadButton from "../FileUploadButton/FileUploadButton";

const OutputTable: React.FC = () => {
  const { data: outputs, refetch } = useOutputs();
  const { mutate: uploadOutput } = useUploadOutput({
    mutation: { onSuccess: async () => await refetch() },
  });
  const { mutate: deleteOutput } = useDeleteOutput({
    mutation: { onSuccess: async () => await refetch() },
  });

  return (
    <Stack gap={0}>
      <Title size={"h3"}>Outputs</Title>
      <DataTable
        highlightOnHover
        withTableBorder
        borderRadius={"md"}
        columns={[
          { accessor: "name", title: "Name" },
          {
            accessor: "created_at",
            title: "Created At",
            render: ({ created_at }) =>
              dayjs(created_at).format("YYYY-MM-DD HH:mm"),
          },
          { accessor: "type_label", title: "Type" },
          {
            accessor: "actions",
            textAlign: "right",
            title: (
              <FileUploadButton
                onFileUpload={(file) => {
                  if (file != null) uploadOutput({ data: { file } });
                }}
                validTypes="application/json"
              />
            ),
            render: ({ id }) => (
              <Menu width={200} position="left-start">
                <Menu.Target>
                  <ActionIcon
                    p={0}
                    variant="subtle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EllipsisVerticalIcon />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                  <Menu.Item
                    leftSection={<Download size={16} />}
                    component={"a"}
                    href={`http://localhost:8000/outputs/${id}/download`}
                  >
                    Download
                  </Menu.Item>

                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<Trash size={16} color={"red"} />}
                    color="red"
                    fw="bold"
                    onClick={async () => {
                      if (id) {
                        deleteOutput({ outputId: id });
                      }
                    }}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ),
          },
        ]}
        records={outputs}
        rowExpansion={{
          content: ({ record }) => <Viewer id={record.id!} />,
        }}
      />
    </Stack>
  );
};

export default OutputTable;
