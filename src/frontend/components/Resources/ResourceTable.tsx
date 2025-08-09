import { Stack, ActionIcon, Title, Menu } from "@mantine/core";
import { Download, EllipsisVerticalIcon, Trash } from "lucide-react";
import { DataTable } from "mantine-datatable";
import dayjs from "dayjs";
import FileUploadButton from "../FileUploadButton/FileUploadButton";
import { useState } from "react";
import ResourceModal from "../Resources/ResourceModal";
import {
  useDeleteResource,
  useResources,
  useUploadResource,
} from "@/api/fastapi/resources/resources";

const ResourceTable: React.FC = () => {
  const { data: resources, refetch } = useResources();
  const [openedResource, setOpenedResource] = useState<string | undefined>();
  const { mutate: uploadResource } = useUploadResource({
    mutation: { onSuccess: async () => await refetch() },
  });
  const { mutate: deleteResource } = useDeleteResource({
    mutation: { onSuccess: async () => await refetch() },
  });

  return (
    <>
      <ResourceModal
        id={openedResource}
        onClose={() => setOpenedResource(undefined)}
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
                    if (file != null) uploadResource({ data: { file } });
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
                          deleteResource({ resourceId: id });
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
          records={resources}
          onRowClick={({ record }) => setOpenedResource(record.id)}
        />
      </Stack>
    </>
  );
};

export default ResourceTable;
