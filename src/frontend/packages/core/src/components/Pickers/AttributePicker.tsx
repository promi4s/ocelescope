import {
  useE2o,
  useEventAttributes,
  useObjectAttributes,
  type ValueType,
} from "@ocelescope/api-base";
import { useColorOf } from "@r4pm/components";
import { useMemo } from "react";
import {
  attributeDefaults,
  attributeOptions,
} from "./internal/attributeOptions";
import { useOcelId } from "./internal/useOcelId";
import { OptionPicker } from "./OptionPicker";
import type { AttributeRef, OcelPickerProps } from "./types";

export type AttributePickerProps = OcelPickerProps<AttributeRef> & {
  /** The activity whose attributes, and whose related objects'
   * attributes, are offered. */
  activity: string | undefined;
  /** Offer attributes of only these related object types. Default: all. */
  objectTypes?: readonly string[];
  /** Offer only object types every event relates to exactly one object of,
   * so an object attribute has one value per event. */
  onlyUniquelyRelated?: boolean;
  /** Offer only attributes of these value types, e.g. `["int", "float"]`. */
  valueTypes?: readonly ValueType[];
};

const attributeId = (ref: AttributeRef) =>
  JSON.stringify(
    ref.target === "event"
      ? ["event", ref.activity, ref.name]
      : ["object", ref.objectType, ref.name],
  );

/**
 * Attributes around an activity: those its events carry, and those of the
 * object types its events relate to, grouped by where they come from.
 */
export const AttributePicker = ({
  activity,
  objectTypes,
  onlyUniquelyRelated = false,
  valueTypes,
  ocelId,
  ocelVersion = "filtered",
  ...picker
}: AttributePickerProps) => {
  const id = useOcelId(ocelId);
  const activityColor = useColorOf("activity");
  const objectTypeColor = useColorOf("objectType");
  const enabled = id != null && activity !== undefined;

  const events = useEventAttributes(
    id,
    { ocel_version: ocelVersion, names: activity ? [activity] : [] },
    { query: { enabled } },
  );
  const relations = useE2o(
    id,
    {
      source_types: activity ? [activity] : [],
      ocel_version: ocelVersion,
      page_size: 1000,
    },
    { query: { enabled } },
  );

  const relatedTypes = useMemo(() => {
    const rows = (relations.data?.response ?? []).filter(
      (row) => row.source === activity,
    );
    // Unique: one qualifier, and exactly one object per event.
    const isUnique = (type: string) => {
      const [row, ...rest] = rows.filter((r) => r.target === type);
      return (
        row !== undefined &&
        rest.length === 0 &&
        row.min_count === 1 &&
        row.max_count === 1
      );
    };
    return [...new Set(rows.map((row) => row.target))]
      .filter((type) => !objectTypes || objectTypes.includes(type))
      .filter((type) => !onlyUniquelyRelated || isUnique(type));
  }, [relations.data, activity, objectTypes, onlyUniquelyRelated]);

  const objects = useObjectAttributes(
    id,
    { ocel_version: ocelVersion, names: relatedTypes },
    { query: { enabled: enabled && relatedTypes.length > 0 } },
  );

  const options = useMemo(() => {
    if (activity === undefined) return [];
    return [
      ...attributeOptions(
        events.data,
        valueTypes,
        (name): AttributeRef => ({ target: "event", activity, name }),
        {
          label: activity,
          color: activityColor(activity),
          caption: "event attributes",
        },
      ),
      ...relatedTypes.flatMap((objectType) =>
        attributeOptions(
          objects.data?.filter((a) => a.entity_type === objectType),
          valueTypes,
          (name): AttributeRef => ({ target: "object", objectType, name }),
          {
            label: objectType,
            color: objectTypeColor(objectType),
            caption: "object attributes",
          },
        ),
      ),
    ];
  }, [
    activity,
    events.data,
    objects.data,
    relatedTypes,
    valueTypes,
    activityColor,
    objectTypeColor,
  ]);

  return (
    <OptionPicker
      options={options}
      idOf={attributeId}
      labelOf={(ref) => ref.name}
      loading={
        events.isPending ||
        relations.isPending ||
        (relatedTypes.length > 0 && objects.isPending)
      }
      error={events.error ?? relations.error ?? objects.error}
      missing={activity === undefined ? "Choose an activity first" : undefined}
      placeholder="Choose an attribute…"
      emptyText="No attributes to choose from"
      {...attributeDefaults}
      {...picker}
    />
  );
};
