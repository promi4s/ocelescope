import { Modal, Text } from "@mantine/core";
import UploadSection from "../UploadSection/UploadSection";
import type { ComponentProps } from "react";

const UploadModal: React.FC<
  {
    isOpen?: boolean;
    onClose: () => void;
  } & Pick<ComponentProps<typeof UploadSection>, "acceptedTypes">
> = ({ isOpen, onClose, acceptedTypes }) => {
  return (
    <Modal
      title={<Text size={"h3"}>Upload</Text>}
      opened={!!isOpen}
      onClose={onClose}
      size={"xl"}
    >
      <UploadSection acceptedTypes={acceptedTypes} onSuccess={onClose} />
    </Modal>
  );
};

export default UploadModal;
