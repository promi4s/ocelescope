import { useObjectCounts } from "@ocelescope/api-base";
import { useColorOf } from "@r4pm/components";
import { useMemo } from "react";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps } from "./types";

export type ObjectTypePickerProps = OcelPickerProps<string>;

/** The log's object types, by how many objects each has. */
export const ObjectTypePicker = ({
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: ObjectTypePickerProps) => {
  const id = useOcelId(ocelId);
  const colorOf = useColorOf("objectType");
  const { data, isPending, error } = useObjectCounts(
    id,
    { ocel_version: ocelVersion },
    { query: { enabled: id != null } },
  );
  const options = useMemo(
    () =>
      Object.entries(data ?? {}).map(([name, count]) => ({
        value: name,
        label: name,
        count,
        color: colorOf(name),
      })),
    [data, colorOf],
  );

  return (
    <OptionPicker
      options={options}
      loading={isPending}
      error={error}
      placeholder="Choose an object type…"
      emptyText="The log has no objects"
      {...picker}
    />
  );
};
