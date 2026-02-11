import { Modal, Text } from "@mantine/core";
import UploadSection from "../UploadSection/UploadSection";

const UploadModal: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      title={<Text size={"h3"}>Upload</Text>}
      opened={visible}
      onClose={onClose}
      size={"xl"}
    >
      <UploadSection />
    </Modal>
  );
};

export default UploadModal;
