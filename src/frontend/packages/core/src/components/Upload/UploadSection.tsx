import { LoadingOverlay, Stack, ThemeIcon } from "@mantine/core";
import {
  useGetDefaultOcel,
  useImportDefaultOcel,
  useUpload,
} from "@ocelescope/api-base";
import { ContainerIcon } from "lucide-react";
import { DataTable } from "mantine-datatable";
import { useCallback, useState } from "react";
import { useInvalidate } from "../../hooks/useInvalidate";
import { FileDropzone } from "../Dropzone/Dropzone";
import { findUploadOption } from "./options/configs";
import type { UploadExtras } from "./options/types";
import { UploadOptions } from "./options/UploadOptions";

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

const FileUploadZone: React.FC<{ onDrop: (files: File[]) => void }> = ({
  onDrop,
}) => (
  <FileDropzone
    content={{
      description: (
        <span>
          {`Drag'n'drop your ${["OCELs", "Plugins", "Resources"].join(", ")} here to upload.`}
        </span>
      ),
    }}
    onUpload={onDrop}
  />
);

export const UploadSection: React.FC<{ onSuccess?: () => void }> = ({
  onSuccess,
}) => {
  const [isPending, setIsPending] = useState(false);
  const invalidate = useInvalidate();

  const onUploadSuccess = useCallback(async () => {
    setIsPending(false);
    await invalidate(["tasks"]);
    onSuccess?.();
  }, [onSuccess]);

  const { mutate } = useUpload({
    mutation: {
      onSuccess: onUploadSuccess,
      onMutate: () => setIsPending(true),
      onSettled: () => setIsPending(false),
    },
  });

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const upload = (files: File[], extras: Record<string, UploadExtras> = {}) => {
    mutate({
      data: {
        files,
        extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : null,
      },
    });
    setPendingFiles([]);
  };

  return (
    <Stack gap={"xs"} pos="relative">
      <LoadingOverlay
        visible={isPending}
        overlayProps={{ radius: "sm", blur: 2 }}
      />
      {pendingFiles.length > 0 ? (
        <UploadOptions
          files={pendingFiles}
          onUpload={upload}
          onCancel={() => setPendingFiles([])}
        />
      ) : (
        <>
          <FileUploadZone
            onDrop={(files) =>
              files.some((file) => findUploadOption(file))
                ? setPendingFiles(files)
                : upload(files)
            }
          />
          <DefaultOcels
            onSuccess={onUploadSuccess}
            setIsPending={setIsPending}
          />
        </>
      )}
    </Stack>
  );
};
