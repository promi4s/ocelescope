import { ActionIcon, FileInput } from "@mantine/core";
import { FileUpIcon } from "lucide-react";
import { useRef } from "react";

const validTypes = "application/zip,application/x-zip-compressed";
const FileUploadButton: React.FC<{
  size?: number;
  onFileUpload: (file: File | null) => void;
}> = ({ size = 16, onFileUpload }) => {
  const uploadRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <ActionIcon
        variant="subtle"
        size={"sm"}
        onClick={() => uploadRef.current?.click()}
      >
        <FileUpIcon size={size} />
      </ActionIcon>
      <FileInput
        display={"none"}
        ref={uploadRef}
        accept={validTypes}
        onChange={onFileUpload}
      />
    </>
  );
};

export default FileUploadButton;
