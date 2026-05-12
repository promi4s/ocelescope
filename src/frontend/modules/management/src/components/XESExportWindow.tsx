import { Button, Modal, Select, Stack } from "@mantine/core";
import { useObjectCounts } from "@ocelescope/api-base";
import { useDownloadFlatOCEL } from "@ocelescope/core";
import { useState } from "react";

export const XESExportWindow: React.FC<{
  ocelId?: string;
  onClose: () => void;
}> = ({ ocelId, onClose }) => {
  const { data: objectCounts } = useObjectCounts(ocelId ?? "", undefined, {
    query: { enabled: !!ocelId },
  });

  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(
    null,
  );

  const { download } = useDownloadFlatOCEL();

  return (
    <Modal opened={!!ocelId} centered onClose={onClose} title="XES Export">
      <Stack>
        <Select
          required
          label="Select the object type to flatten the log to"
          placeholder="Pick value"
          data={Object.keys(objectCounts ?? {})}
          searchable
          value={selectedObjectType}
          onChange={(newObjectType) => setSelectedObjectType(newObjectType)}
        />
        <Button
          disabled={!selectedObjectType}
          onClick={() => {
            if (ocelId && selectedObjectType) {
              download(ocelId, { object_type_name: selectedObjectType });
              onClose();
            }
          }}
        >
          Export
        </Button>
      </Stack>
    </Modal>
  );
};
