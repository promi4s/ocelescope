import { useUpload } from "@ocelescope/api-base";
import { FileDropzone } from "@ocelescope/core";

type PluginUploadSectionProps = {
  onSuccess?: () => void;
};

export const PluginUploadSection = ({
  onSuccess,
}: PluginUploadSectionProps) => {
  const { mutateAsync: upload } = useUpload({
    mutation: {
      onSuccess,
    },
  });
  return (
    <FileDropzone
      onUpload={async (data: File[]) => await upload({ data: { files: data } })}
      content={{ description: "Drag'n'drop your Plugins to upload." }}
      accept={["application/x-zip-compressed", "application/zip"]}
    />
  );
};
