import { ComponentProps, useRef } from "react";
import { Button, Group, Text, useMantineTheme } from "@mantine/core";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import classes from "@/components/Dropzone/Dropzone.module.css";
import { DownloadIcon, Upload, X } from "lucide-react";

const FileDropzone: React.FC<{
  onUpload: (files: FileWithPath[]) => void;
  accept?: ComponentProps<typeof Dropzone>["accept"];
  content: {
    accept?: React.ReactNode;
    reject?: React.ReactNode;
    idle?: React.ReactNode;
    description?: React.ReactNode;
  };
}> = ({ onUpload, accept, content }) => {
  const theme = useMantineTheme();
  const openRef = useRef<() => void>(null);

  return (
    <div className={classes.wrapper}>
      <Dropzone
        openRef={openRef}
        onDrop={onUpload}
        className={classes.dropzone}
        radius="md"
        accept={accept}
      >
        <div style={{ pointerEvents: "none" }}>
          <Group justify="center">
            <Dropzone.Accept>
              <DownloadIcon size={50} color={theme.colors.blue[6]} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <X size={50} color={theme.colors.red[6]} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <Upload size={50} className={classes.icon} />
            </Dropzone.Idle>
          </Group>

          <Text ta="center" fw={700} fz="lg" mt="xl">
            {content.accept && (
              <Dropzone.Accept>{content.accept}</Dropzone.Accept>
            )}
            {content.reject && (
              <Dropzone.Reject>{content.reject}</Dropzone.Reject>
            )}
            {content.idle && <Dropzone.Idle>{content.idle}</Dropzone.Idle>}
          </Text>

          <Text className={classes.description}>
            {content.description || (
              <span>Drag&apos;n&apos;drop files here to upload.</span>
            )}
          </Text>
        </div>
      </Dropzone>

      <Button
        className={classes.control}
        size="sm"
        radius="xl"
        onClick={() => openRef.current?.()}
      >
        Select files
      </Button>
    </div>
  );
};

export default FileDropzone;
