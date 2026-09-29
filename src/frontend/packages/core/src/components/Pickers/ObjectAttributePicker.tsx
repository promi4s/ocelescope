import { useObjectAttributes, type ValueType } from "@ocelescope/api-base";
import { useMemo } from "react";
import {
  attributeDefaults,
  attributeOptions,
} from "./internal/attributeOptions";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { OcelPickerProps } from "./types";

export type ObjectAttributePickerProps = OcelPickerProps<string> & {
  /** Offer only what objects of this type carry. Without it, every attribute
   * any object in the log carries. */
  objectType?: string;
  /** Offer only attributes of these value types, e.g. `["int", "float"]`. */
  valueTypes?: readonly ValueType[];
};

/** The attributes objects carry, by name. */
export const ObjectAttributePicker = ({
  objectType,
  valueTypes,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: ObjectAttributePickerProps) => {
  const id = useOcelId(ocelId);
  const { data, isPending, error } = useObjectAttributes(
    id,
    {
      ocel_version: ocelVersion,
      ...(objectType ? { names: [objectType] } : {}),
    },
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
      placeholder="Choose an object attribute…"
      emptyText={
        objectType
          ? "Objects of this type carry no attributes"
          : "Objects carry no attributes"
      }
      {...attributeDefaults}
      {...picker}
    />
  );
};
