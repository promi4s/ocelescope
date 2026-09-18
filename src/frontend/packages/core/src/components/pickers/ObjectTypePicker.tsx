import { useObjectCounts } from "@ocelescope/api-base";
import { useOcelId } from "./internal/useOcelId";
import { NamePicker, type NamePickerProps } from "./NamePicker";
import type { OcelSource, Selection } from "./types";

export type ObjectTypePickerProps = OcelSource &
  Omit<NamePickerProps, "items" | "scope" | "loading">;

/** The log's object types, by how often they occur. */
export const ObjectTypePicker = ({
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: ObjectTypePickerProps & Selection) => {
  const id = useOcelId(ocelId);
  const { data, isPending } = useObjectCounts(
    id,
    { ocel_version: ocelVersion },
    { query: { enabled: id != null } },
  );

  return (
    <NamePicker
      items={data ?? {}}
      scope="objectType"
      loading={isPending}
      {...picker}
    />
  );
};
