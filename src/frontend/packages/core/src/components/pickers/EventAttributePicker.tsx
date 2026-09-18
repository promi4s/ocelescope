import { useEventAttributes } from "@ocelescope/api-base";
import { useOcelId } from "./internal/useOcelId";
import { NamePicker, type NamePickerProps } from "./NamePicker";
import type { OcelSource, Selection } from "./types";

export type EventAttributePickerProps = OcelSource &
  Omit<NamePickerProps, "items" | "scope" | "loading"> & {
    /** Offer only what this activity's events carry. Without it, every
     * attribute any event in the log carries. */
    activity?: string;
  };

/** The attributes events carry, counted by how many values each takes. */
export const EventAttributePicker = ({
  activity,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: EventAttributePickerProps & Selection) => {
  const id = useOcelId(ocelId);
  const { data, isPending } = useEventAttributes(
    id,
    { ocel_version: ocelVersion, ...(activity ? { names: [activity] } : {}) },
    { query: { enabled: id != null } },
  );

  return (
    <NamePicker
      items={(data ?? []).map((attribute) => ({
        key: attribute.name,
        count: attribute.distinct_values,
      }))}
      scope="attribute"
      loading={isPending}
      // Distinct values say how varied an attribute is, not how often it
      // occurs, so by default they neither sort the list nor draw bars.
      bars={false}
      cutoff={false}
      sort="name"
      {...picker}
    />
  );
};
