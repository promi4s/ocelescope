import { Group, LoadingOverlay, Modal, Text } from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { useUpload } from "@ocelescope/api-base";
import { DownloadIcon, UploadIcon, XIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { useInvalidate } from "../../hooks/useInvalidate";
import { findUploadOption } from "./options/configs";
import type { UploadExtras } from "./options/types";
import { UploadOptions } from "./options/UploadOptions";

const defaultLabel = `Drag'n'drop your ${["OCELs", "Plugins", "Resources"].join(", ")} here to upload.`;

export const FullScreenUpload: React.FC<{
  onSuccess?: () => void;
  accept?: ComponentProps<typeof Dropzone.FullScreen>["accept"];
  label?: React.ReactNode;
  active?: boolean;
}> = ({ onSuccess, accept, label = defaultLabel, active = true }) => {
  const invalidate = useInvalidate();

  const { mutate, isPending } = useUpload({
    mutation: {
      onSuccess: async () => {
        await invalidate(["tasks"]);
        onSuccess?.();
      },
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
    <>
      <LoadingOverlay visible={isPending} overlayProps={{ blur: 2 }} />
      <Modal
        opened={pendingFiles.length > 0}
        onClose={() => setPendingFiles([])}
        centered
        size="lg"
        title={<Text fw={600}>Upload options</Text>}
      >
        <UploadOptions
          files={pendingFiles}
          onUpload={upload}
          onCancel={() => setPendingFiles([])}
        />
      </Modal>
      <Dropzone.FullScreen
        active={active}
        accept={accept}
        withinPortal={false}
        styles={{
          fullScreen: {
            position: "absolute",
            padding: 0,
            backgroundColor: "var(--mantine-color-body)",
          },
          root: { backgroundColor: "transparent" },
          inner: {
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
        onDrop={(files: FileWithPath[]) =>
          files.some((file) => findUploadOption(file))
            ? setPendingFiles(files)
            : upload(files)
        }
      >
        <Group
          justify="center"
          gap="xl"
          mih={220}
          style={{ pointerEvents: "none" }}
        >
          <Dropzone.Accept>
            <DownloadIcon size={52} color="var(--mantine-color-blue-6)" />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <XIcon size={52} color="var(--mantine-color-red-6)" />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <UploadIcon size={52} color="var(--mantine-color-dimmed)" />
          </Dropzone.Idle>

          <div style={{ textAlign: "center" }}>
            <Text size="xl" inline>
              {label}
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Release to start the upload.
            </Text>
          </div>
        </Group>
      </Dropzone.FullScreen>
    </>
  );
};
