import { useE2o, useObjectCounts } from "@ocelescope/api-base";
import { useColorOf } from "@r4pm/components";
import { useMemo } from "react";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps } from "./types";

export type ObjectTypePickerProps = OcelPickerProps<string> & {
  /** Offer only the object types that events of this activity relate to. */
  activity?: string;
};

/** The log's object types, by how many objects each has. */
export const ObjectTypePicker = ({
  activity,
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
  const relations = useE2o(
    id,
    {
      source_types: activity ? [activity] : [],
      ocel_version: ocelVersion,
      page_size: 1000,
    },
    { query: { enabled: id != null && activity !== undefined } },
  );
  const options = useMemo(() => {
    const related =
      activity === undefined
        ? undefined
        : new Set(
            (relations.data?.response ?? [])
              .filter((row) => row.source === activity)
              .map((row) => row.target),
          );
    return Object.entries(data ?? {})
      .filter(([name]) => !related || related.has(name))
      .map(([name, count]) => ({
        value: name,
        label: name,
        count,
        color: colorOf(name),
      }));
  }, [data, colorOf, activity, relations.data]);

  return (
    <OptionPicker
      options={options}
      loading={isPending || (activity !== undefined && relations.isPending)}
      error={error ?? relations.error}
      placeholder="Choose an object type…"
      emptyText="The log has no objects"
      {...picker}
    />
  );
};
