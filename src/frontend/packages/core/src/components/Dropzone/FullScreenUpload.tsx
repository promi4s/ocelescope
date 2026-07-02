import { Group, LoadingOverlay, Text } from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { useUpload } from "@ocelescope/api-base";
import { DownloadIcon, UploadIcon, XIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useInvalidate } from "../../hooks/useInvalidate";

const defaultLabel = `Drag'n'drop your ${["OCELs", "Plugins", "Resources"].join(", ")} here to upload.`;

export const FullScreenUpload: React.FC<{
  onSuccess?: () => void;
  accept?: ComponentProps<typeof Dropzone.FullScreen>["accept"];
  label?: React.ReactNode;
}> = ({ onSuccess, accept, label = defaultLabel }) => {
  const invalidate = useInvalidate();

  const { mutate: upload, isPending } = useUpload({
    mutation: {
      onSuccess: async () => {
        await invalidate(["tasks"]);
        onSuccess?.();
      },
    },
  });

  return (
    <>
      <LoadingOverlay visible={isPending} overlayProps={{ blur: 2 }} />
      <Dropzone.FullScreen
        active
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
        onDrop={(files: FileWithPath[]) => {
          upload({ data: { files } });
        }}
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
