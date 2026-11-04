import { ActionIcon, Tooltip } from "@mantine/core";
import { useGetOcel } from "@ocelescope/api-base";
import { OCELMappingWindow } from "@ocelescope/core";
import { TableIcon } from "lucide-react";
import { useState } from "react";
import { useFilterView } from "../hooks/useView";
import type { NativeFilter } from "./FilterViews";

const FilteredMappingWindow: React.FC<{
  ocel: { id: string; name: string };
  steps: NativeFilter[];
  onClose: () => void;
}> = ({ ocel, steps, onClose }) => {
  const viewId = useFilterView(ocel.id, steps);

  return (
    <OCELMappingWindow
      ocel={viewId ? ocel : undefined}
      viewId={viewId ?? undefined}
      onClose={onClose}
    />
  );
};

export const CreateMappingAction: React.FC<{
  ocelId: string;
  steps: NativeFilter[];
}> = ({ ocelId, steps }) => {
  const [opened, setOpened] = useState(false);
  const { data: ocel } = useGetOcel(ocelId);

  return (
    <>
      <Tooltip label="Create mapping">
        <ActionIcon
          variant="subtle"
          disabled={!ocel}
          onClick={() => setOpened(true)}
        >
          <TableIcon size={20} />
        </ActionIcon>
      </Tooltip>
      {opened && ocel && (
        <FilteredMappingWindow
          ocel={{ id: ocel.id, name: ocel.name }}
          steps={steps}
          onClose={() => setOpened(false)}
        />
      )}
    </>
  );
};
