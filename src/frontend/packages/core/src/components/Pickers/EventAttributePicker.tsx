import { useEventAttributes, type ValueType } from "@ocelescope/api-base";
import { useMemo } from "react";
import {
  attributeDefaults,
  attributeOptions,
} from "./internal/attributeOptions";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps } from "./types";

export type EventAttributePickerProps = OcelPickerProps<string> & {
  /** Offer only what events of this type carry. Without it, every attribute
   * any event in the log carries. */
  activity?: string;
  /** Offer only attributes of these value types, e.g. `["int", "float"]`. */
  valueTypes?: readonly ValueType[];
};

/** The attributes events carry, by name. */
export const EventAttributePicker = ({
  activity,
  valueTypes,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: EventAttributePickerProps) => {
  const id = useOcelId(ocelId);
  const { data, isPending, error } = useEventAttributes(
    id,
    { ocel_version: ocelVersion, ...(activity ? { names: [activity] } : {}) },
    { query: { enabled: id != null } },
  );
  const options = useMemo(
    () => attributeOptions(data, valueTypes, (name) => name),
    [data, valueTypes],
  );

  return (
    <OptionPicker
      options={options}
      loading={isPending}
      error={error}
      placeholder="Choose an event attribute…"
      emptyText={
        activity
          ? "Events of this type carry no attributes"
          : "Events carry no attributes"
      }
      {...attributeDefaults}
      {...picker}
    />
  );
};
