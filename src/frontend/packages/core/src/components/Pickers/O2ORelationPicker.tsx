import { useO2o } from "@ocelescope/api-base";
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

export type O2ORelationPickerProps = OcelPickerProps<Relation> & {
  /** Offer only relations of objects of this type. Without it, every object
   * type's, grouped by object type. */
  objectType?: string;
};

/**
 * How objects relate to objects: one choice per object type and qualifier,
 * with how many objects an object relates to.
 */
export const O2ORelationPicker = ({
  objectType,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: O2ORelationPickerProps) => {
  const id = useOcelId(ocelId);
  const objectTypeColor = useColorOf("objectType");
  const { data, isPending, error } = useO2o(
    id,
    {
      ...(objectType ? { source_types: [objectType] } : {}),
      ocel_version: ocelVersion,
      page_size: 1000,
    },
    { query: { enabled: id != null } },
  );
  const options = useMemo(
    () =>
      relationOptions({
        rows: data?.response ?? [],
        source: objectType,
        unit: "object",
        sourceColor: objectTypeColor,
        targetColor: objectTypeColor,
      }),
    [data, objectType, objectTypeColor],
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
        objectType
          ? "Objects of this type relate to no objects"
          : "Objects relate to no objects"
      }
      {...picker}
    />
  );
};
