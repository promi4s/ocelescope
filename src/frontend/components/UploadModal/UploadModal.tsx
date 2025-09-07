import { Modal, Title } from "@mantine/core";
import UploadSection from "../UploadSection/UploadSection";
import { ComponentProps } from "react";

const UploadModal: React.FC<
  {
    isOpen?: boolean;
    onClose: () => void;
  } & Pick<ComponentProps<typeof UploadSection>, "acceptedTypes">
> = ({ isOpen, onClose, acceptedTypes }) => {
  return (
    <Modal
      title={<Title size={"h3"}>Upload</Title>}
      opened={!!isOpen}
      onClose={onClose}
      size={"xl"}
    >
      <UploadSection acceptedTypes={acceptedTypes} onSuccess={onClose} />
    </Modal>
  );
};

export default UploadModal;
