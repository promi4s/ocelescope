import { DataTable } from "mantine-datatable";

import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import { ContainerIcon } from "lucide-react";
import useInvalidate from "../../hooks/useInvalidate";
import FileDropzone from "../Dropzone/Dropzone";
import { useCallback, useState } from "react";
import {
  useGetDefaultOcel,
  useImportDefaultOcel,
  useUpload,
} from "@ocelescope/api-base";

const DefaultOcels: React.FC<{
  onSuccess: () => void;
  setIsPending: (pendingState: boolean) => void;
}> = ({ onSuccess, setIsPending }) => {
  const { data: ocels = [] } = useGetDefaultOcel({});

  const invalidate = useInvalidate();

  const { mutate: uploadDefault } = useImportDefaultOcel({
    mutation: {
      onSuccess: async () => {
        await invalidate(["ocels"]);
        onSuccess();
      },
      onMutate: () => setIsPending(true),
      onSettled: () => setIsPending(false),
    },
  });

  return (
    <DataTable
      noHeader
      records={ocels}
      idAccessor={"key"}
      highlightOnHover={true}
      withRowBorders={false}
      onRowClick={({ record }) => {
        uploadDefault({ params: { ...record } });
      }}
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
  );
};

const FileUploadZone: React.FC<{
  onSuccess: () => void;
  setIsPending: (pendingState: boolean) => void;
}> = ({ onSuccess, setIsPending }) => {
  const { mutate: upload } = useUpload({
    mutation: {
      onSuccess,
      onMutate: () => setIsPending(true),
      onSettled: () => setIsPending(false),
    },
  });

  return (
    <FileDropzone
      content={{
        description: (
          <span>
            {`Drag'n'drop your ${["OCELs", "Plugins", "Resources"].join(", ")} here to upload.`}
          </span>
        ),
      }}
      onUpload={async (files: File[]) => {
        upload({ data: { files } });
      }}
    />
  );
};

const UploadSection: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [isPending, setIsPending] = useState(false);

  const onUploadSuccess = useCallback(() => {
    setIsPending(false);
    onSuccess?.();
  }, [onSuccess]);

  return (
    <Stack gap={"xs"} pos="relative">
      <LoadingOverlay
        visible={isPending}
        overlayProps={{ radius: "sm", blur: 2 }}
      />
      <FileUploadZone onSuccess={onUploadSuccess} setIsPending={setIsPending} />
      <DefaultOcels onSuccess={onUploadSuccess} setIsPending={setIsPending} />
    </Stack>
  );
};

export default UploadSection;
