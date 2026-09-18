import { useObjectAttributes } from "@ocelescope/api-base";
import { useOcelId } from "./internal/useOcelId";
import { NamePicker, type NamePickerProps } from "./NamePicker";
import type { OcelSource, Selection } from "./types";

export type ObjectAttributePickerProps = OcelSource &
  Omit<NamePickerProps, "items" | "scope" | "loading"> & {
    /** Offer only what objects of this type carry. Without it, every
     * attribute any object in the log carries. */
    objectType?: string;
  };

/** The attributes objects carry, counted by how many values each takes. */
export const ObjectAttributePicker = ({
  objectType,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: ObjectAttributePickerProps & Selection) => {
  const id = useOcelId(ocelId);
  const { data, isPending } = useObjectAttributes(
    id,
    {
      ocel_version: ocelVersion,
      ...(objectType ? { names: [objectType] } : {}),
    },
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
