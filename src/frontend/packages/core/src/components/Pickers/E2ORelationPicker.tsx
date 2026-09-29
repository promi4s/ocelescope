import { useE2o } from "@ocelescope/api-base";
import { useColorOf } from "@r4pm/components";
import { useMemo } from "react";
import {
  relationId,
  relationLabel,
  relationOptions,
} from "./internal/relationOptions";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps, Relation } from "./types";

export type E2ORelationPickerProps = OcelPickerProps<Relation> & {
  /** Offer only relations of events of this type. Without it, every event
   * type's, grouped by event type. */
  activity?: string;
};

/**
 * How events relate to objects: one choice per object type and qualifier,
 * with how many objects an event relates to.
 */
export const E2ORelationPicker = ({
  activity,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: E2ORelationPickerProps) => {
  const id = useOcelId(ocelId);
  const activityColor = useColorOf("activity");
  const objectTypeColor = useColorOf("objectType");
  const { data, isPending, error } = useE2o(
    id,
    {
      ...(activity ? { source_types: [activity] } : {}),
      ocel_version: ocelVersion,
      page_size: 1000,
    },
    { query: { enabled: id != null } },
  );
  const options = useMemo(
    () =>
      relationOptions({
        rows: data?.response ?? [],
        source: activity,
        unit: "event",
        sourceColor: activityColor,
        targetColor: objectTypeColor,
      }),
    [data, activity, activityColor, objectTypeColor],
  );

  return (
    <OptionPicker
      options={options}
      idOf={relationId}
      labelOf={relationLabel}
      loading={isPending}
      error={error}
      placeholder="Choose a relation…"
      emptyText={
        activity
          ? "Events of this type relate to no objects"
          : "Events relate to no objects"
      }
      {...picker}
    />
  );
};
