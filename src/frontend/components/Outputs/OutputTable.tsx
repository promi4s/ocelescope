import {
  useDeleteOutput,
  useOutputs,
  useUploadOutput,
} from "@/api/fastapi/outputs/outputs";
import { Stack, ActionIcon, Title, Menu } from "@mantine/core";
import { Download, EllipsisVerticalIcon, Trash } from "lucide-react";
import { DataTable } from "mantine-datatable";
import dayjs from "dayjs";
import FileUploadButton from "../FileUploadButton/FileUploadButton";
import { useState } from "react";
import OutputModal from "./OutputModal";

const OutputTable: React.FC = () => {
  const { data: outputs, refetch } = useOutputs();
  const [openedOutput, setOpenedOutput] = useState<string | undefined>();
  const { mutate: uploadOutput } = useUploadOutput({
    mutation: { onSuccess: async () => await refetch() },
  });
  const { mutate: deleteOutput } = useDeleteOutput({
    mutation: { onSuccess: async () => await refetch() },
  });

  return (
    <>
      <OutputModal
        id={openedOutput}
        onClose={() => setOpenedOutput(undefined)}
      />
      <Stack gap={0}>
        <Title size={"h3"}>Outputs</Title>
        <DataTable
          highlightOnHover
          withTableBorder
          borderRadius={"md"}
          minHeight={300}
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
          onRowClick={({ record }) => setOpenedOutput(record.id)}
        />
      </Stack>
    </>
  );
};

export default OutputTable;
