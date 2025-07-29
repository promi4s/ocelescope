import { usePlugins, useUploadPlugin } from "@/api/fastapi/plugins/plugins";
import FileUploadButton from "@/components/FileUploadButton/FileUploadButton";
import { Title, Container, ActionIcon, Group, Stack } from "@mantine/core";
import { Play } from "lucide-react";
import { DataTable } from "mantine-datatable";
import Link from "next/link";
import { useState } from "react";

const PluginOverview: React.FC = () => {
  const { data: plugins } = usePlugins();

  const { mutate: uploadPlugin } = useUploadPlugin();
  const [expandedPlugins, setExpandedPlugins] = useState<string[]>([]);

  return (
    <Container>
      <Stack gap={0}>
        <Title size={"h3"}> Plugins</Title>
        <DataTable
          columns={[
            {
              title: "Name",
              accessor: "metadata.label",
            },
            { title: "Description", accessor: "metadata.description" },
            {
              title: "Version",
              accessor: "metadata.version",
              textAlign: "center",
            },
            {
              title: (
                <Group align="center" justify="end">
                  <FileUploadButton
                    validTypes="application/json"
                    onFileUpload={(file) => {
                      if (file != null) {
                        uploadPlugin({ data: { file: file } });
                      }
                    }}
                  />
                </Group>
              ),
              accessor: "actions",
              width: "0%",
            },
          ]}
          records={plugins}
          highlightOnHover
          withTableBorder
          borderRadius={"md"}
          idAccessor={({ metadata }) => `${metadata.name}_${metadata.version}`}
          rowExpansion={{
            allowMultiple: false,
            expanded: {
              recordIds: expandedPlugins,
              onRecordIdsChange: setExpandedPlugins,
            },
            content: ({ record }) => {
              return (
                <DataTable
                  noHeader
                  columns={[
                    { accessor: "label" },
                    { accessor: "description" },
                    {
                      accessor: "actions",
                      title: "",
                      width: "0%", // 👈 set width to 0%
                      textAlign: "right",
                      render: ({ name }) => (
                        <ActionIcon
                          size={"xs"}
                          component={Link}
                          href={{
                            query: { version: record.metadata.version },
                            pathname: `plugins/${record.metadata.name}/${name}`,
                          }}
                          color="green"
                          variant="subtle"
                        >
                          <Play />
                        </ActionIcon>
                      ),
                    },
                  ]}
                  records={Object.values(record.methods)}
                />
              );
            },
          }}
        />
      </Stack>
    </Container>
  );
};

export default PluginOverview;
