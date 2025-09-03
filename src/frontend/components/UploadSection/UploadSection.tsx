import { Box, Stack, ThemeIcon, Title } from "@mantine/core";
import FileDropzone from "../Dropzone/Dropzone";
import {
  useGetDefaultOcel,
  useImportDefaultOcel,
} from "@/api/fastapi/ocels/ocels";
import { DataTable } from "mantine-datatable";
import { ContainerIcon } from "lucide-react";
import useInvalidate from "@/hooks/useInvalidateResources";

type UploadTypes = "ocel" | "resource" | "plugin";

const UploadSection: React.FC<{ acceptedTypes?: UploadTypes[] }> = () => {
  const { data: ocels } = useGetDefaultOcel({ only_latest_versions: true });

  const invalidate = useInvalidate();

  const { mutate } = useImportDefaultOcel({
    mutation: { onSuccess: async () => await invalidate(["ocels"]) },
  });

  return (
    <Stack gap={"xs"}>
      <Title size={"h3"}>Upload</Title>
      <FileDropzone
        onUpload={() => {}}
        content={{
          description: (
            <span>
              Drag&apos;n&apos;drop your OCELs, Resources and Plugins here to
              upload.
            </span>
          ),
        }}
        accept={{
          "application/json": [".json", ".jsonocel"],
          "application/xml": [".xml", ".xmlocel"],
          "application/vnd.sqlite3": [".sqlite"],
          "application/zip": [".zip"],
        }}
      />
      <Title size={"h4"}>Default OCELS</Title>
      {ocels && (
        <Box flex={1} mih={0}>
          <DataTable
            noHeader
            records={ocels}
            highlightOnHover
            withRowBorders={false}
            onRowClick={({ record }) => mutate({ params: { ...record } })}
            columns={[
              {
                accessor: "",
                render: () => (
                  <ThemeIcon variant="transparent">
                    <ContainerIcon />
                  </ThemeIcon>
                ),
              },
              { accessor: "name" },
              {
                accessor: "version",
                textAlign: "right",
                render: ({ version }) => `v${version}`,
              },
            ]}
          />
        </Box>
      )}
    </Stack>
  );
};

export default UploadSection;
