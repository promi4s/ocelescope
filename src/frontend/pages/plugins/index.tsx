import {
  useDeletePlugin,
  usePlugins,
  useUploadPlugin,
} from "@/api/fastapi/plugins/plugins";
import FileUploadButton from "@/components/FileUploadButton/FileUploadButton";
import {
  Title,
  Container,
  ActionIcon,
  Group,
  Stack,
  ThemeIcon,
  LoadingOverlay,
} from "@mantine/core";
import { ChevronDown, ChevronRight, Play, Trash2Icon } from "lucide-react";
import { DataTable } from "mantine-datatable";
import Link from "next/link";
import { useState } from "react";

const PluginOverview: React.FC = () => {
  const { data: plugins } = usePlugins();

  const { mutate: deletePlugin, isPending } = useDeletePlugin();
  const { mutate: uploadPlugin } = useUploadPlugin();

  const [expandedPlugins, setExpandedPlugins] = useState<string[]>([]);

  return (
    <Container pos={"relative"} h={"100%"}>
      <LoadingOverlay visible={isPending} />
      <Stack gap={0} h={"100%"}>
        <Title size={"h3"}> Plugins</Title>
        <DataTable
          flex={1}
          columns={[
            {
              title: "Name",
              accessor: "meta.label",
            },
            { title: "Description", accessor: "meta.description" },
            {
              title: "Version",
              accessor: "meta.version",
              textAlign: "center",
            },
            {
              title: (
                <Group align="center" justify="end">
                  <FileUploadButton
                    validTypes=".zip,application/zip,application/x-zip-compressed"
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
              textAlign: "right",
              render: ({ id, meta }) => (
                <Group justify="end" gap={"xs"}>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => deletePlugin({ pluginId: id })}
                  >
                    <Trash2Icon size={16} />
                  </ActionIcon>
                  {expandedPlugins.some((pluginId) => pluginId === id) ? (
                    <ThemeIcon variant="subtle">
                      <ChevronDown />
                    </ThemeIcon>
                  ) : (
                    <ThemeIcon variant="subtle">
                      <ChevronRight />
                    </ThemeIcon>
                  )}
                </Group>
              ),
            },
          ]}
          records={plugins}
          highlightOnHover
          withTableBorder
          borderRadius={"md"}
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
                      width: "0%",
                      textAlign: "right",
                      render: ({ name }) => (
                        <ActionIcon
                          size={"xs"}
                          component={Link}
                          href={{
                            pathname: `plugins/${record.id}/${name}`,
                          }}
                          color="green"
                          variant="subtle"
                        >
                          <Play />
                        </ActionIcon>
                      ),
                    },
                  ]}
                  records={record.methods}
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
