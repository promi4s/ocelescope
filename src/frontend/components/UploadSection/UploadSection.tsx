import { Box, LoadingOverlay, Stack, ThemeIcon, Title } from "@mantine/core";
import FileDropzone from "../Dropzone/Dropzone";
import {
  useGetDefaultOcel,
  useImportDefaultOcel,
} from "@/api/fastapi/ocels/ocels";
import { DataTable } from "mantine-datatable";
import { ContainerIcon } from "lucide-react";
import useInvalidate from "@/hooks/useInvalidateResources";
import { useUpload } from "@/api/fastapi/session/session";
import { useNotificationContext } from "../TaskNotification/TaskNotificationProvider";

type UploadTypes = "ocel" | "resource" | "plugin";

const uploadTypeToString: Record<UploadTypes, string> = {
  ocel: "OCELs",
  resource: "Resources",
  plugin: "Plugins",
};

const UploadSection: React.FC<{
  acceptedTypes?: UploadTypes[];
  onSuccess?: () => void;
}> = ({ onSuccess, acceptedTypes = ["plugin", "ocel", "resource"] }) => {
  const { data: ocels } = useGetDefaultOcel({ only_latest_versions: true });

  const invalidate = useInvalidate();

  const { mutate: uploadDefault, isPending: isDefaultUploadPending } =
    useImportDefaultOcel({
      mutation: {
        onSuccess: async () => {
          await invalidate(["ocels"]);
          onSuccess?.();
        },
      },
    });

  const { addNotification } = useNotificationContext();
  const { mutate: upload, isPending: isUploadPending } = useUpload({
    mutation: {
      onSuccess: (tasks) => {
        addNotification({
          tasks,
          title: "Uploading",
          message: "Uploading files!",
        });

        onSuccess?.();
      },
    },
  });

  return (
    <Stack gap={"xs"} pos="relative">
      <LoadingOverlay
        visible={isUploadPending || isDefaultUploadPending}
        overlayProps={{ radius: "sm", blur: 2 }}
      />
      <FileDropzone
        content={{
          description: (
            <span>
              {`Drag'n'drop your ${acceptedTypes.map((type) => uploadTypeToString[type]).join(", ")} here to upload.`}
            </span>
          ),
        }}
        accept={{
          "application/json": [".json", ".jsonocel", ".ocelescope"],
          "application/xml": [".xml", ".xmlocel"],
          "application/vnd.sqlite3": [".sqlite"],
          "application/zip": [".zip"],
        }}
        onUpload={async (files: File[]) => {
          upload({ data: { files } });
        }}
      />
      {ocels && acceptedTypes.includes("ocel") && (
        <>
          <Title size={"h4"}>Default OCELS</Title>
          <Box flex={1} mih={0}>
            <DataTable
              noHeader
              records={ocels}
              highlightOnHover
              idAccessor={"key"}
              withRowBorders={false}
              onRowClick={({ record }) =>
                uploadDefault({ params: { ...record } })
              }
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
        </>
      )}
    </Stack>
  );
};

export default UploadSection;
