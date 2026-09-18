import { useEventCounts } from "@ocelescope/api-base";
import { useOcelId } from "./internal/useOcelId";
import { NamePicker, type NamePickerProps } from "./NamePicker";
import type { OcelSource, Selection } from "./types";

export type ActivityPickerProps = OcelSource &
  Omit<NamePickerProps, "items" | "scope" | "loading">;

/** The log's activities, by how often they occur. */
export const ActivityPicker = ({
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: ActivityPickerProps & Selection) => {
  const id = useOcelId(ocelId);
  const { data, isPending } = useEventCounts(
    id,
    { ocel_version: ocelVersion },
    { query: { enabled: id != null } },
  );

  return (
    <NamePicker
      items={data ?? {}}
      scope="activity"
      loading={isPending}
      {...picker}
    />
  );
};
